import { os } from '@orpc/server'
import { publicProcedure } from './base'
import { z } from 'zod'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { Prisma } from '@prisma/client'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { ORPCError } from '@orpc/shared/error'
import {
  ShipmentListQuerySchema,
  createPaginatedResponseSchema,
  buildShipmentWhereClause,
  buildShipmentOrderByClause,
} from './schemas'
import { serializeShipment, serializeShipments } from '@/lib/infrastructure/repositories/serializers'
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'
import type { FrontConversation, FrontMessage } from '@/lib/infrastructure/sdks/front/schemas'
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'
import { createShip24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import type { TrackingUpdateResult } from '@/lib/application/types'

/**
 * Shipment response schema (camelCase API format)
 */
const ShipmentResponseSchema = z.object({
  id: z.number(),
  trackingNumber: z.string(),
  carrier: z.string().nullable(),
  status: z.string(),
  poNumber: z.string().nullable(),
  supplier: z.string().nullable(),
  shippedDate: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  deliveredDate: z.string().nullable(),
  ship24Status: z.string().nullable(),
  ship24LastUpdate: z.string().nullable(),
  lastChecked: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trackingEvents: z.array(z.object({
    id: z.number(),
    status: z.string().nullable(),
    location: z.string().nullable(),
    message: z.string().nullable(),
    eventTime: z.string().nullable(),
  })).optional(),
})

const formatShipmentForApi = (shipment: ReturnType<typeof serializeShipment>) => ({
  ...shipment,
  shippedDate: shipment.shippedDate?.toISOString() ?? null,
  estimatedDelivery: shipment.estimatedDelivery?.toISOString() ?? null,
  deliveredDate: shipment.deliveredDate?.toISOString() ?? null,
  ship24LastUpdate: shipment.ship24LastUpdate?.toISOString() ?? null,
  lastChecked: shipment.lastChecked?.toISOString() ?? null,
  createdAt: shipment.createdAt.toISOString(),
  updatedAt: shipment.updatedAt.toISOString(),
  trackingEvents: shipment.trackingEvents?.map((event) => ({
    ...event,
    eventTime: event.eventTime?.toISOString() ?? null,
  })),
})

const shipmentsRouter = os.router({
  list: publicProcedure
      .input(ShipmentListQuerySchema)
      .output(createPaginatedResponseSchema(ShipmentResponseSchema))
      .handler(async ({ context, input }) => {
        const { pagination, filter, sort } = input

        const page = pagination?.page ?? 1
        const pageSize = pagination?.pageSize ?? 20
        const skip = (page - 1) * pageSize

        const where = buildShipmentWhereClause(filter)
        const orderBy = buildShipmentOrderByClause(sort)

        // Get total count for pagination
        const total = await context.prisma.shipments.count({ where })

        // Get paginated results with tracking events
        const shipments = await context.prisma.shipments.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include: {
            tracking_events: {
              orderBy: { event_time: 'desc' },
              take: 5,
            },
          },
        })

        // Serialize to camelCase
        const serialized = serializeShipments(shipments)
        const formatted = serialized.map(formatShipmentForApi)

        return {
          items: formatted,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            hasNext: page * pageSize < total,
            hasPrev: page > 1,
          },
        }
      }),

    create: publicProcedure
      .input(shipmentSchema)
      .output(ShipmentResponseSchema)
      .handler(async ({ context, input }) => {
        const existingShipment = await context.prisma.shipments.findUnique({
          where: { tracking_number: input.trackingNumber },
        })

        if (existingShipment) {
          throw new ORPCError({
            code: 'CONFLICT',
            message: 'A shipment with this tracking number already exists',
          })
        }

        const shipmentData: Prisma.shipmentsCreateInput = {
          tracking_number: input.trackingNumber,
          carrier: input.carrier,
          status: 'pending',
          updated_at: new Date(),
        }

        if (input.poNumber) shipmentData.po_number = input.poNumber
        if (input.supplier) shipmentData.supplier = input.supplier
        if (input.shippedDate) shipmentData.shipped_date = new Date(input.shippedDate)
        if (input.estimatedDelivery) shipmentData.estimated_delivery = new Date(input.estimatedDelivery)

        const service = getShipmentTrackingService()
        try {
          const result = await service.registerTracker(
            input.trackingNumber,
            input.carrier,
            input.poNumber || undefined
          )
          
          if (result.success && result.trackerId) {
            shipmentData.ship24_tracker_id = result.trackerId
          }
        } catch (trackerError: unknown) {
          console.warn(`⚠️  Failed to register tracker for ${input.trackingNumber}:`, getErrorMessage(trackerError))
        }

        const shipment = await context.prisma.shipments.create({
          data: shipmentData,
          include: {
            tracking_events: {
              orderBy: { event_time: 'desc' },
              take: 5,
            },
          },
        })

        return formatShipmentForApi(serializeShipment(shipment))
      }),
})

const trackingStatsRouter = os.router({
  get: publicProcedure
      .output(z.object({
        total: z.number(),
        active: z.number(),
        byStatus: z.object({
          delivered: z.number(),
          in_transit: z.number(),
          pending: z.number(),
          exception: z.number(),
        }),
        recentlyChecked: z.number(),
        needsUpdate: z.number(),
        timestamp: z.string(),
      }))
      .handler(async ({ context }) => {
        const [totalShipments, deliveredCount, inTransitCount, pendingCount, exceptionCount, recentlyChecked, needsUpdate] = 
          await Promise.all([
            context.prisma.shipments.count(),
            context.prisma.shipments.count({ where: { status: 'delivered' } }),
            context.prisma.shipments.count({ where: { status: 'in_transit' } }),
            context.prisma.shipments.count({ where: { status: 'pending' } }),
            context.prisma.shipments.count({ where: { status: 'exception' } }),
            context.prisma.shipments.count({ where: { last_checked: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
            context.prisma.shipments.count({
              where: {
                status: { notIn: ['delivered'] },
                OR: [
                  { last_checked: null },
                  { last_checked: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                ]
              }
            })
          ])

        return {
          total: totalShipments,
          active: totalShipments - deliveredCount,
          byStatus: { delivered: deliveredCount, in_transit: inTransitCount, pending: pendingCount, exception: exceptionCount },
          recentlyChecked,
          needsUpdate,
          timestamp: new Date().toISOString()
        }
      }),
})

const syncHistoryRouter = os.router({
  get: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).default({ limit: 10 }))
      .output(z.object({
        success: z.boolean(),
        history: z.array(z.object({
          id: z.number(),
          startedAt: z.date(),
          completedAt: z.date().nullable(),
          status: z.string(),
          conversationsProcessed: z.number(),
          shipmentsAdded: z.number(),
          conversationsAlreadyScanned: z.number(),
          shipmentsSkipped: z.number(),
          conversationsWithNoTracking: z.number(),
          durationMs: z.number().nullable(),
          errors: z.array(z.string()),
        })),
        lastSync: z.object({
          id: z.number(),
          startedAt: z.date(),
          completedAt: z.date().nullable(),
          status: z.string(),
          conversationsProcessed: z.number(),
          shipmentsAdded: z.number(),
          conversationsAlreadyScanned: z.number(),
          shipmentsSkipped: z.number(),
          conversationsWithNoTracking: z.number(),
          durationMs: z.number().nullable(),
          errors: z.array(z.string()),
        }).nullable(),
      }))
      .handler(async ({ context, input }) => {
        const limit = input.limit
        const historyRecords = await context.prisma.sync_history.findMany({
          orderBy: { started_at: 'desc' },
          take: limit,
        })
        const lastSyncRecord = await context.prisma.sync_history.findFirst({
          where: { status: { in: ['success', 'partial'] } },
          orderBy: { completed_at: 'desc' },
        })

        const mapRecord = (record: { id: number; started_at: Date; completed_at: Date | null; conversations_processed: number; shipments_added: number; conversations_already_scanned: number; shipments_skipped: number; conversations_with_no_tracking: number; errors: unknown; status: string; duration_ms: number | null }) => ({
          id: record.id,
          startedAt: record.started_at,
          completedAt: record.completed_at,
          status: record.status,
          conversationsProcessed: record.conversations_processed,
          shipmentsAdded: record.shipments_added,
          conversationsAlreadyScanned: record.conversations_already_scanned,
          shipmentsSkipped: record.shipments_skipped,
          conversationsWithNoTracking: record.conversations_with_no_tracking,
          durationMs: record.duration_ms,
          errors: Array.isArray(record.errors) ? record.errors.map(String) : [],
        })

        return {
          success: true,
          history: historyRecords.map(mapRecord),
          lastSync: lastSyncRecord ? mapRecord(lastSyncRecord) : null,
        }
      }),
})

const manualUpdateTrackingRouter = os.router({
  update: publicProcedure
      .output(
        z.object({
          success: z.boolean(),
          checked: z.number(),
          updated: z.number(),
          delivered: z.number().optional(),
          errors: z.number(),
          durationMs: z.number(),
          timestamp: z.string(),
        })
      )
      .handler(async ({ context }) => {
        const startTime = Date.now()

        try {
          console.log('=== Manual Tracking Update Started ===')

          const limit = 50
          const shipments = await context.prisma.shipments.findMany({
            where: {
              status: {
                notIn: ['delivered'],
              },
              ship24_tracker_id: {
                not: null,
              },
            },
            orderBy: {
              last_checked: 'asc',
            },
            take: limit,
          })

          console.log(`Found ${shipments.length} shipments to update`)

          if (shipments.length === 0) {
            return {
              success: true,
              checked: 0,
              updated: 0,
              delivered: 0,
              errors: 0,
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }
          }

          const ship24Client = createShip24Client()
          const results: TrackingUpdateResult[] = []
          let errors = 0

          for (const shipment of shipments) {
            try {
              console.log(`Updating ${shipment.tracking_number}...`)

              const response = await ship24Client.getTrackerResults(shipment.ship24_tracker_id!)

              if (response.data?.trackings?.[0]) {
                const tracking = response.data.trackings[0]
                const trackingUpdate = Ship24Mapper.toDomainTrackingUpdate(tracking)

                const newStatus = trackingUpdate.status.type
                const oldStatus = shipment.status

                await context.prisma.shipments.update({
                  where: { id: shipment.id },
                  data: {
                    status: newStatus,
                    last_checked: new Date(),
                    ...(trackingUpdate.estimatedDelivery && {
                      estimated_delivery: trackingUpdate.estimatedDelivery,
                    }),
                    ...(trackingUpdate.deliveredDate && {
                      delivered_date: trackingUpdate.deliveredDate,
                    }),
                    ...(trackingUpdate.shippedDate && {
                      shipped_date: trackingUpdate.shippedDate,
                    }),
                  },
                })

                const statusChanged = oldStatus !== newStatus

                results.push({
                  success: true,
                  trackingNumber: shipment.tracking_number,
                  oldStatus,
                  newStatus,
                  statusChanged,
                })

                if (statusChanged) {
                  console.log(`  ✓ ${shipment.tracking_number}: ${oldStatus} → ${newStatus}`)
                }
              } else {
                results.push({
                  success: false,
                  trackingNumber: shipment.tracking_number,
                  oldStatus: shipment.status,
                  newStatus: shipment.status,
                  statusChanged: false,
                  error: 'No tracking data available',
                })
              }
            } catch (error) {
              console.error(`  ✗ Error updating ${shipment.tracking_number}:`, getErrorMessage(error))
              errors++
              results.push({
                success: false,
                trackingNumber: shipment.tracking_number,
                oldStatus: shipment.status,
                newStatus: shipment.status,
                statusChanged: false,
                error: getErrorMessage(error),
              })
            }
          }

          const duration = Date.now() - startTime

          const summary = {
            success: true,
            checked: shipments.length,
            updated: results.filter((r: TrackingUpdateResult) => r.statusChanged).length,
            delivered: results.filter((r: TrackingUpdateResult) => r.newStatus === 'delivered').length,
            errors,
            durationMs: duration,
            timestamp: new Date().toISOString(),
          }

          console.log('=== Manual Update Complete ===')
          console.log(JSON.stringify(summary, null, 2))

          return summary
        } catch (error) {
          console.error('=== Manual Update Error ===')
          console.error('Error:', getErrorMessage(error))

          throw new ORPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: getErrorMessage(error),
          })
        }
      }),
})

const trackersRouter = os.router({
  backfill: publicProcedure
      .output(z.object({
        success: z.boolean(),
        registered: z.number(),
        skipped: z.number(),
        errors: z.number(),
        total: z.number(),
        errorMessages: z.array(z.string()).optional(),
        durationMs: z.number(),
        timestamp: z.string(),
        message: z.string().optional(),
      }))
      .handler(async ({ context }) => {
        const startTime = Date.now()

        try {
          console.log('=== Ship24 Tracker Backfill Started ===')

          interface UnregisteredShipment {
            id: number
            tracking_number: string
            carrier: string | null
            po_number: string | null
            status: string
          }

          // Find all shipments without a ship24_tracker_id
          const unregisteredShipments = await context.prisma.shipments.findMany({
            where: {
              ship24_tracker_id: null,
            },
            select: {
              id: true,
              tracking_number: true,
              carrier: true,
              po_number: true,
              status: true,
            },
          })

          console.log(`Found ${unregisteredShipments.length} shipments to register`)

          if (unregisteredShipments.length === 0) {
            return {
              success: true,
              message: 'All shipments already registered',
              registered: 0,
              skipped: 0,
              errors: 0,
              total: 0,
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }
          }

          let registered = 0
          const skipped = 0
          let errors = 0
          const errorMessages: string[] = []

          // Process in batches of 50 (Ship24 bulk limit)
          const BATCH_SIZE = 50
          const service = getShipmentTrackingService()

          for (let i = 0; i < unregisteredShipments.length; i += BATCH_SIZE) {
            const batch = unregisteredShipments.slice(i, i + BATCH_SIZE)

            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} shipments)`)

            try {
              // Prepare tracker data
              const trackerData = batch.map((s: UnregisteredShipment) => ({
                trackingNumber: s.tracking_number,
                carrier: s.carrier,
                poNumber: s.po_number || undefined,
              }))

              // Register trackers in bulk
              const results = await service.registerTrackersBulk(trackerData)

              console.log(`  Received ${results.length} results`)

              // Update database with tracker IDs
              for (const result of results) {
                const shipment = batch.find((s: UnregisteredShipment) => s.tracking_number === result.trackingNumber)

                if (shipment) {
                  if (result.success && result.trackerId) {
                    try {
                      await context.prisma.shipments.update({
                        where: { id: shipment.id },
                        data: {
                          ship24_tracker_id: result.trackerId,
                          updated_at: new Date(),
                        },
                      })

                      registered++
                      console.log(`  ✅ Registered: ${shipment.tracking_number} → ${result.trackerId}`)
                    } catch (updateErr) {
                      errors++
                      const msg =
                        updateErr instanceof Error
                          ? `Failed to update ${shipment.tracking_number}: ${updateErr.message}`
                          : `Failed to update ${shipment.tracking_number}: Unknown error`
                      console.error(`  ❌ ${msg}`)
                      errorMessages.push(msg)
                    }
                  } else {
                    errors++
                    const msg = `Failed to register ${result.trackingNumber}: ${result.error || 'Unknown error'}`
                    console.error(`  ❌ ${msg}`)
                    errorMessages.push(msg)
                  }
                }
              }

              // Rate limiting: small delay between batches
              if (i + BATCH_SIZE < unregisteredShipments.length) {
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
            } catch (batchErr) {
              errors += batch.length
              const msg =
                batchErr instanceof Error
                  ? `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${batchErr.message}`
                  : `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: Unknown error`
              console.error(`  ❌ ${msg}`)
              errorMessages.push(msg)
            }
          }

          const duration = Date.now() - startTime

          const summary = {
            success: true,
            registered,
            skipped,
            errors,
            total: unregisteredShipments.length,
            errorMessages: errorMessages.slice(0, 10),
            durationMs: duration,
            timestamp: new Date().toISOString(),
          }

          console.log('=== Backfill Complete ===')
          console.log(JSON.stringify(summary, null, 2))

          return summary
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Failed to backfill trackers'

          console.error('=== Backfill Error ===')
          console.error('Error:', errorMessage)

          throw new ORPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          })
        }
      }),
})

const frontRouter = os.router({
  scan: publicProcedure
      .input(
        z.object({
          after: z.string().optional(),
          batchSize: z.number().default(50),
          pageSize: z.number().default(100),
          maxPages: z.number().optional(),
          forceRescan: z.boolean().default(false),
        })
      )
      .output(
        z.object({
          success: z.boolean(),
          summary: z.object({
            conversationsProcessed: z.number(),
            conversationsAlreadyScanned: z.number(),
            shipmentsAdded: z.number(),
            shipmentsUpdated: z.number(),
            shipmentsSkipped: z.number(),
            conversationsWithNoTracking: z.number(),
            batchSize: z.number(),
            totalConversations: z.number(),
          }),
          errors: z.array(z.string()),
          durationMs: z.number(),
          timestamp: z.string(),
        })
      )
      .handler(async ({ context, input }) => {
        const startTime = Date.now()

        try {
          console.log('=== Front Scan Started ===')
          console.log('📥 Request params:', input)

          const { after, batchSize, pageSize, maxPages, forceRescan } = input

          const frontClient = getFrontClient()
          const service = getShipmentTrackingService()

          const afterDate = after
            ? new Date(after)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          console.log(`Fetching conversations after: ${afterDate.toISOString()}`)

          const inboxId = process.env.FRONT_INBOX_ID

          if (!inboxId) {
            throw new ORPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'FRONT_INBOX_ID environment variable is not set',
            })
          }

          console.log(`Using inbox ID: ${inboxId}`)

          const conversations = await frontClient.searchAllInboxConversations(inboxId, {
            pageSize,
            after: afterDate,
            maxPages,
          })

          console.log(`Found ${conversations.length} total conversations`)

          if (conversations.length === 0) {
            return {
              success: true,
              summary: {
                conversationsProcessed: 0,
                conversationsAlreadyScanned: 0,
                shipmentsAdded: 0,
                shipmentsUpdated: 0,
                shipmentsSkipped: 0,
                conversationsWithNoTracking: 0,
                batchSize,
                totalConversations: 0,
              },
              errors: [],
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }
          }

          // Developer Mode: Allow rescanning already analyzed conversations
          const isDevMode = process.env.DEV_ALLOW_RESCAN === 'true'
          const shouldRescan = forceRescan && isDevMode

          if (shouldRescan) {
            console.log('🔄 DEV MODE: Force rescanning ALL conversations')
          }

          const conversationIds = conversations.map((c: FrontConversation) => c.id)
          const alreadyScanned = shouldRescan
            ? []
            : await context.prisma.scanned_conversations.findMany({
                where: {
                  conversation_id: { in: conversationIds },
                },
                select: { conversation_id: true },
              })

          const scannedIds = new Set(alreadyScanned.map((s) => s.conversation_id))
          const unscannedConversations = shouldRescan
            ? conversations
            : conversations.filter((c: FrontConversation) => !scannedIds.has(c.id))

          console.log(
            `${unscannedConversations.length} conversations need scanning (${scannedIds.size} already scanned)`
          )

          if (unscannedConversations.length === 0) {
            return {
              success: true,
              summary: {
                conversationsProcessed: 0,
                conversationsAlreadyScanned: scannedIds.size,
                shipmentsAdded: 0,
                shipmentsUpdated: 0,
                shipmentsSkipped: 0,
                conversationsWithNoTracking: 0,
                batchSize,
                totalConversations: conversations.length,
              },
              errors: [],
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }
          }

          // Process conversations helper
          const processBatch = async (
            convos: FrontConversation[],
            rescan: boolean
          ): Promise<{
            added: number
            updated: number
            skipped: number
            noTracking: number
            errors: string[]
          }> => {
            const results = {
              added: 0,
              updated: 0,
              skipped: 0,
              noTracking: 0,
              errors: [] as string[],
            }

            await Promise.allSettled(
              convos.map(async (conversation) => {
                try {
                  const messages = await frontClient.getConversationMessages(conversation.id)

                  if (messages.length === 0) {
                    await context.prisma.scanned_conversations.upsert({
                      where: { conversation_id: conversation.id },
                      update: { scanned_at: new Date() },
                      create: {
                        conversation_id: conversation.id,
                        subject: conversation.subject,
                        shipments_found: 0,
                      },
                    })
                    results.noTracking++
                    return
                  }

                  const messagesToExtract = messages.map((msg: FrontMessage) => ({
                    subject: msg.subject || conversation.subject,
                    body: msg.text || msg.body,
                    senderEmail: msg.author?.email || msg.recipients[0]?.handle || '',
                    senderName: msg.author?.name || msg.author?.username || '',
                    date: new Date(msg.created_at * 1000).toISOString(),
                  }))

                  const extractionResult = await extractTrackingFromEmail(messagesToExtract)

                  if (!extractionResult || extractionResult.shipments.length === 0) {
                    await context.prisma.scanned_conversations.upsert({
                      where: { conversation_id: conversation.id },
                      update: { scanned_at: new Date() },
                      create: {
                        conversation_id: conversation.id,
                        subject: conversation.subject,
                        shipments_found: 0,
                      },
                    })
                    results.noTracking++
                    return
                  }

                  const shipmentsToRegister = []

                  for (const shipment of extractionResult.shipments) {
                    const existing = await context.prisma.shipments.findUnique({
                      where: { tracking_number: shipment.trackingNumber },
                    })

                    if (existing) {
                      if (rescan) {
                        const updateData: Prisma.shipmentsUpdateInput = {
                          updated_at: new Date(),
                        }

                        if (shipment.carrier) updateData.carrier = shipment.carrier
                        if (shipment.poNumber) updateData.po_number = shipment.poNumber
                        if (extractionResult.supplier) updateData.supplier = extractionResult.supplier
                        if (shipment.shippedDate)
                          updateData.shipped_date = new Date(shipment.shippedDate)
                        if (!existing.front_conversation_id)
                          updateData.front_conversation_id = conversation.id

                        const updatedShipment = await context.prisma.shipments.update({
                          where: { tracking_number: shipment.trackingNumber },
                          data: updateData,
                        })

                        shipmentsToRegister.push(updatedShipment)
                        results.updated++
                      } else {
                        results.skipped++

                        if (!existing.front_conversation_id) {
                          await context.prisma.shipments.update({
                            where: { tracking_number: shipment.trackingNumber },
                            data: {
                              front_conversation_id: conversation.id,
                              updated_at: new Date(),
                            },
                          })
                        }
                      }
                      continue
                    }

                    const newShipment = await context.prisma.shipments.create({
                      data: {
                        tracking_number: shipment.trackingNumber,
                        carrier: shipment.carrier ?? null,
                        po_number: shipment.poNumber || null,
                        supplier: extractionResult.supplier || null,
                        shipped_date: shipment.shippedDate
                          ? new Date(shipment.shippedDate)
                          : null,
                        status: 'pending',
                        front_conversation_id: conversation.id,
                        updated_at: new Date(),
                      },
                    })

                    shipmentsToRegister.push(newShipment)
                    results.added++
                  }

                  if (shipmentsToRegister.length > 0) {
                    try {
                      const bulkResults = await service.registerTrackersBulk(
                        shipmentsToRegister.map((s) => ({
                          trackingNumber: s.tracking_number,
                          carrier: s.carrier,
                          poNumber: s.po_number || undefined,
                        }))
                      )

                      const failureCount = bulkResults.filter((r) => !r.success).length
                      if (failureCount > 0) {
                        results.errors.push(`${failureCount} trackers failed registration`)
                      }
                    } catch (err) {
                      results.errors.push(`Ship24 registration failed: ${getErrorMessage(err)}`)
                    }
                  }

                  await context.prisma.scanned_conversations.upsert({
                    where: { conversation_id: conversation.id },
                    update: {
                      scanned_at: new Date(),
                      shipments_found: results.added + results.updated,
                    },
                    create: {
                      conversation_id: conversation.id,
                      subject: conversation.subject,
                      shipments_found: results.added + results.updated,
                    },
                  })
                } catch (error) {
                  results.errors.push(`${conversation.id}: ${getErrorMessage(error)}`)
                }
              })
            )

            return results
          }

          const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            alreadyScanned: scannedIds.size,
            noTracking: 0,
            errors: [] as string[],
          }

          // Process batches
          const batches: FrontConversation[][] = []
          for (let i = 0; i < unscannedConversations.length; i += batchSize) {
            batches.push(unscannedConversations.slice(i, i + batchSize))
          }

          if (shouldRescan) {
            for (let i = 0; i < batches.length; i++) {
              const batchResult = await processBatch(batches[i], forceRescan)
              results.added += batchResult.added
              results.updated += batchResult.updated
              results.skipped += batchResult.skipped
              results.noTracking += batchResult.noTracking
              results.errors.push(...batchResult.errors)
            }
          } else {
            const batchResults = await Promise.all(
              batches.map((batch) => processBatch(batch, forceRescan))
            )

            for (const batchResult of batchResults) {
              results.added += batchResult.added
              results.updated += batchResult.updated
              results.skipped += batchResult.skipped
              results.noTracking += batchResult.noTracking
              results.errors.push(...batchResult.errors)
            }
          }

          const duration = Date.now() - startTime

          console.log('=== Scan Complete ===')

          return {
            success: true,
            summary: {
              conversationsProcessed: unscannedConversations.length,
              conversationsAlreadyScanned: results.alreadyScanned,
              shipmentsAdded: results.added,
              shipmentsUpdated: results.updated,
              shipmentsSkipped: results.skipped,
              conversationsWithNoTracking: results.noTracking,
              batchSize,
              totalConversations: conversations.length,
            },
            errors: results.errors,
            durationMs: duration,
            timestamp: new Date().toISOString(),
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? getErrorMessage(error) : 'Failed to scan conversations'

          console.error('=== Scan Error ===')
          console.error('Error:', errorMessage)

          throw new ORPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          })
        }
      }),
})

// Flatten the router for testing
export const appRouter = os.router({
  'shipments.list': shipmentsRouter.list,
  'shipments.create': shipmentsRouter.create,
  'trackingStats.get': trackingStatsRouter.get,
  'syncHistory.get': syncHistoryRouter.get,
  'manualUpdateTracking.update': manualUpdateTrackingRouter.update,
  'trackers.backfill': trackersRouter.backfill,
  'front.scan': frontRouter.scan,
})

export type AppRouter = typeof appRouter
