import { ORPCError } from '@orpc/server'
import { publicProcedure } from './base'
import { z } from 'zod'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { Prisma } from '@prisma/client'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import {
  ShipmentListQuerySchema,
  ShipmentSummarySchema,
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
  carrier: z.string().nullish(),
  status: z.string(),
  poNumber: z.string().nullish(),
  supplier: z.string().nullish(),
  shippedDate: z.string().nullish(),
  estimatedDelivery: z.string().nullish(),
  deliveredDate: z.string().nullish(),
  ship24Status: z.string().nullish(),
  ship24LastUpdate: z.string().nullish(),
  lastChecked: z.string().nullish(),
  lastError: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trackingEvents: z.array(z.object({
    id: z.number(),
    status: z.string().nullish(),
    location: z.string().nullish(),
    message: z.string().nullish(),
    eventTime: z.string().nullish(),
  })).optional(),
  // OMG Orders integration
  omgData: z.object({
    orderNumber: z.string(), // Human-readable order number (e.g., "164")
    orderName: z.string().nullish(),
    customerName: z.string().nullish(),
    orderUrl: z.string(),
    poUrl: z.string(),
  }).nullish(),
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
const shipmentsRouter = {
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
        // Get counts for all statuses (unfiltered by status, but respecting search)
        const searchFilter = filter?.search ? {
          OR: [
            { tracking_number: { contains: filter.search, mode: 'insensitive' as const } },
            { po_number: { contains: filter.search, mode: 'insensitive' as const } },
            { supplier: { contains: filter.search, mode: 'insensitive' as const } },
          ],
        } : {}
        const [
          total,
          pending,
          infoReceived,
          inTransit,
          outForDelivery,
          failedAttempt,
          availableForPickup,
          delivered,
          exception,
          trackingErrors,
        ] = await Promise.all([
          context.prisma.shipments.count({ where: searchFilter }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'pending' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'info_received' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'in_transit' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'out_for_delivery' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'failed_attempt' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'available_for_pickup' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'delivered' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, status: 'exception' } }),
          context.prisma.shipments.count({ where: { ...searchFilter, last_error: { not: null } } }),
        ])
        // Get paginated results with tracking events and OMG data
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
            omg_purchase_order: true,
          },
        })
        
        // Import OMG URL helper
        const { getOmgUrls } = await import('@/lib/infrastructure/omg')
        
        // Serialize to camelCase and add OMG data
        const serialized = serializeShipments(shipments)
        const formatted = serialized.map((shipment, index) => {
          const omgPo = shipments[index].omg_purchase_order
          const base = formatShipmentForApi(shipment)
          
          if (omgPo) {
            const urls = getOmgUrls(omgPo.omg_order_id, omgPo.omg_po_id)
            return {
              ...base,
              omgData: {
                orderNumber: omgPo.order_number,
                orderName: omgPo.order_name,
                customerName: omgPo.customer_name,
                orderUrl: urls.order,
                poUrl: urls.purchaseOrder,
              },
            }
          }
          
          return { ...base, omgData: null }
        })
        const filteredTotal = await context.prisma.shipments.count({ where })
        const result = {
          items: formatted,
          pagination: {
            page,
            pageSize,
            total: filteredTotal,
            totalPages: Math.ceil(filteredTotal / pageSize),
            hasNext: page * pageSize < filteredTotal,
            hasPrev: page > 1,
          },
          statusCounts: {
            all: total,
            pending,
            infoReceived,
            inTransit,
            outForDelivery,
            failedAttempt,
            availableForPickup,
            delivered,
            exception,
            trackingErrors,
          },
        }
        // Debug logging
        console.log('📦 shipments.list result structure:', {
          itemsCount: result.items.length,
          firstItem: result.items[0] ? Object.keys(result.items[0]) : [],
          pagination: result.pagination,
          statusCounts: result.statusCounts,
        })
        return result
      }),
  create: publicProcedure
      .input(shipmentSchema)
      .output(ShipmentResponseSchema)
      .handler(async ({ context, input }) => {
        const existingShipment = await context.prisma.shipments.findUnique({
          where: { tracking_number: input.trackingNumber },
        })
        if (existingShipment) {
          throw new ORPCError('CONFLICT', {
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

        // Auto-sync with OMG if shipment has a PO number (non-blocking)
        if (input.poNumber) {
          import('@/lib/infrastructure/omg').then(({ syncShipmentOmgData }) => {
            syncShipmentOmgData(shipment.id).catch((err) => {
              console.warn(`[OMG] Auto-sync failed for shipment ${shipment.id}:`, err)
            })
          })
        }

        return formatShipmentForApi(serializeShipment(shipment))
      }),
  summary: publicProcedure
      .output(ShipmentSummarySchema)
      .handler(async ({ context }) => {
        const now = new Date()
        // Run all counts in parallel for performance
        const [
          total,
          pending,
          inTransit,
          delivered,
          exceptions,
          trackingErrors,
          neverChecked,
          overdueShipments,
        ] = await Promise.all([
          // Total shipments
          context.prisma.shipments.count(),
          // Pending (not yet shipped or in transit)
          context.prisma.shipments.count({
            where: { status: 'pending' },
          }),
          // In transit (includes out_for_delivery)
          context.prisma.shipments.count({
            where: {
              status: {
                in: ['in_transit', 'out_for_delivery'],
              },
            },
          }),
          // Delivered
          context.prisma.shipments.count({
            where: { status: 'delivered' },
          }),
          // Delivery exceptions only (carrier-reported issues)
          context.prisma.shipments.count({
            where: {
              status: { in: ['exception', 'failed_attempt'] },
            },
          }),
          // Tracking/sync errors (can't fetch tracking data)
          context.prisma.shipments.count({
            where: {
              last_error: { not: null },
            },
          }),
          // Never checked (no last_checked timestamp)
          context.prisma.shipments.count({
            where: {
              last_checked: null,
            },
          }),
          // Overdue (not delivered, has estimated delivery, and past that date)
          context.prisma.shipments.findMany({
            where: {
              status: { not: 'delivered' },
              estimated_delivery: {
                not: null,
                lt: now,
              },
            },
            select: { id: true },
          }),
        ])
        return {
          total,
          pending,
          inTransit,
          delivered,
          overdue: overdueShipments.length,
          exceptions,
          trackingErrors,
          neverChecked,
        }
      }),

  delete: publicProcedure
      .input(z.object({
        shipmentId: z.number(),
      }))
      .output(z.object({
        success: z.boolean(),
        trackingNumber: z.string(),
      }))
      .handler(async ({ context, input }) => {
        const { shipmentId } = input
        
        const shipment = await context.prisma.shipments.findUnique({
          where: { id: shipmentId },
        })
        
        if (!shipment) {
          throw new ORPCError('NOT_FOUND', {
            message: `Shipment with ID ${shipmentId} not found`,
          })
        }
        
        // Delete associated tracking events first
        await context.prisma.tracking_events.deleteMany({
          where: { shipment_id: shipmentId },
        })
        
        // Delete the shipment
        await context.prisma.shipments.delete({
          where: { id: shipmentId },
        })
        
        console.log(`🗑️ Deleted shipment: ${shipment.tracking_number}`)
        
        return {
          success: true,
          trackingNumber: shipment.tracking_number,
        }
      }),

  /**
   * Sync shipment tracking to OMG Orders
   * Pushes tracking number to the matching PO in OMG, then syncs OMG data back
   */
  syncToOmg: publicProcedure
      .input(z.object({
        shipmentId: z.number(),
      }))
      .output(z.object({
        success: z.boolean(),
        message: z.string(),
        poNumber: z.string().nullish(),
        omgUrls: z.object({
          order: z.string(),
          purchaseOrder: z.string(),
        }).nullish(),
      }))
      .handler(async ({ context, input }) => {
        const { shipmentId } = input
        
        // Get shipment
        const shipment = await context.prisma.shipments.findUnique({
          where: { id: shipmentId },
        })
        
        if (!shipment) {
          throw new ORPCError('NOT_FOUND', {
            message: `Shipment with ID ${shipmentId} not found`,
          })
        }
        
        // Validate required fields
        if (!shipment.po_number) {
          return {
            success: false,
            message: 'Shipment has no PO number',
            poNumber: null,
            omgUrls: null,
          }
        }
        
        if (!shipment.carrier) {
          return {
            success: false,
            message: 'Shipment has no carrier',
            poNumber: shipment.po_number,
            omgUrls: null,
          }
        }
        
        // Import OMG modules dynamically to avoid issues if env vars not set
        const { addTrackingToPurchaseOrder, syncShipmentOmgData, getShipmentOmgData } = await import('@/lib/infrastructure/omg')
        
        try {
          const result = await addTrackingToPurchaseOrder(shipment.po_number, {
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            status: 'Shipped',
          })
          
          if (result) {
            console.log(`✅ Synced shipment ${shipment.tracking_number} to OMG PO ${shipment.po_number}`)
            
            // Also sync OMG data back to our database
            await syncShipmentOmgData(shipmentId)
            
            // Get the OMG URLs
            const omgData = await getShipmentOmgData(shipmentId)
            
            return {
              success: true,
              message: `Tracking synced to OMG PO ${shipment.po_number}`,
              poNumber: shipment.po_number,
              omgUrls: omgData?.urls ?? null,
            }
          } else {
            return {
              success: false,
              message: `PO ${shipment.po_number} not found in OMG`,
              poNumber: shipment.po_number,
              omgUrls: null,
            }
          }
        } catch (err) {
          console.error(`❌ Failed to sync to OMG:`, err)
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Unknown error syncing to OMG',
            poNumber: shipment.po_number,
            omgUrls: null,
          }
        }
      }),
}
const trackingStatsRouter = {
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
}
const syncHistoryRouter = {
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
}
const manualUpdateTrackingRouter = {
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
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: getErrorMessage(error),
          })
        }
      }),

  refreshOne: publicProcedure
      .input(z.object({
        shipmentId: z.number(),
      }))
      .output(z.object({
        success: z.boolean(),
        trackingNumber: z.string(),
        oldStatus: z.string(),
        newStatus: z.string(),
        statusChanged: z.boolean(),
        error: z.string().optional(),
        lastError: z.string().nullish(),
      }))
      .handler(async ({ context, input }) => {
        const { shipmentId } = input
        
        console.log(`=== Refreshing single shipment ID: ${shipmentId} ===`)
        
        const shipment = await context.prisma.shipments.findUnique({
          where: { id: shipmentId },
        })
        
        if (!shipment) {
          throw new ORPCError('NOT_FOUND', {
            message: `Shipment with ID ${shipmentId} not found`,
          })
        }
        
        if (!shipment.ship24_tracker_id) {
          return {
            success: false,
            trackingNumber: shipment.tracking_number,
            oldStatus: shipment.status,
            newStatus: shipment.status,
            statusChanged: false,
            error: 'Shipment does not have a Ship24 tracker registered',
            lastError: shipment.last_error,
          }
        }
        
        try {
          const ship24Client = createShip24Client()
          const response = await ship24Client.getTrackerResults(shipment.ship24_tracker_id)
          
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
                last_error: null, // Clear the error on success
                ...(trackingUpdate.estimatedDelivery && {
                  estimated_delivery: trackingUpdate.estimatedDelivery,
                }),
                ...(trackingUpdate.deliveredDate && {
                  delivered_date: trackingUpdate.deliveredDate,
                }),
                ...(trackingUpdate.shippedDate && {
                  shipped_date: trackingUpdate.shippedDate,
                }),
                ...(trackingUpdate.carrier && {
                  carrier: trackingUpdate.carrier,
                }),
                ship24_status: tracking.shipment?.statusMilestone || null,
                ship24_last_update: new Date(),
              },
            })
            
            const statusChanged = oldStatus !== newStatus
            console.log(`  ✓ ${shipment.tracking_number}: ${oldStatus} → ${newStatus}`)
            
            return {
              success: true,
              trackingNumber: shipment.tracking_number,
              oldStatus,
              newStatus,
              statusChanged,
              lastError: null,
            }
          } else {
            const errorMsg = 'No tracking data available from Ship24'
            await context.prisma.shipments.update({
              where: { id: shipment.id },
              data: {
                last_checked: new Date(),
                last_error: errorMsg,
              },
            })
            
            return {
              success: false,
              trackingNumber: shipment.tracking_number,
              oldStatus: shipment.status,
              newStatus: shipment.status,
              statusChanged: false,
              error: errorMsg,
              lastError: errorMsg,
            }
          }
        } catch (error) {
          const errorMsg = getErrorMessage(error)
          console.error(`  ✗ Error refreshing ${shipment.tracking_number}:`, errorMsg)
          
          await context.prisma.shipments.update({
            where: { id: shipment.id },
            data: {
              last_checked: new Date(),
              last_error: errorMsg,
            },
          })
          
          return {
            success: false,
            trackingNumber: shipment.tracking_number,
            oldStatus: shipment.status,
            newStatus: shipment.status,
            statusChanged: false,
            error: errorMsg,
            lastError: errorMsg,
          }
        }
      }),
}
const trackersRouter = {
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
          // Validation helper: filter out invalid tracking numbers
          const isValidTrackingNumber = (trackingNumber: string): boolean => {
            // Must be 5-50 characters
            if (trackingNumber.length < 5 || trackingNumber.length > 50) return false
            // Can only contain letters, numbers, and hyphens
            if (!/^[a-zA-Z0-9-]+$/.test(trackingNumber)) return false
            // No all-zeros or excessive consecutive zeros
            if (/^0+$/.test(trackingNumber)) return false // All zeros
            if (/0{10,}/.test(trackingNumber)) return false // 10+ consecutive zeros
            // No all-same character
            if (/^(.)\1+$/.test(trackingNumber)) return false
            return true
          }
          // Filter out invalid tracking numbers
          const validShipments = unregisteredShipments.filter((s: UnregisteredShipment) => {
            const valid = isValidTrackingNumber(s.tracking_number)
            if (!valid) {
              console.log(`  ⏭️  Skipping invalid: ${s.tracking_number}`)
              errorMessages.push(`Skipped invalid tracking number: ${s.tracking_number}`)
            }
            return valid
          })
          console.log(`${validShipments.length} valid tracking numbers, ${unregisteredShipments.length - validShipments.length} invalid (skipped)`)
          if (validShipments.length === 0) {
            return {
              success: true,
              message: 'No valid tracking numbers to register',
              registered: 0,
              skipped: unregisteredShipments.length,
              errors: 0,
              total: unregisteredShipments.length,
              errorMessages,
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }
          }
          // Process in batches of 50 (Ship24 bulk limit)
          const BATCH_SIZE = 50
          const service = getShipmentTrackingService()
          for (let i = 0; i < validShipments.length; i += BATCH_SIZE) {
            const batch = validShipments.slice(i, i + BATCH_SIZE)
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
              if (i + BATCH_SIZE < validShipments.length) {
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
          const invalidCount = unregisteredShipments.length - validShipments.length
          const summary = {
            success: true,
            registered,
            skipped: invalidCount, // Invalid tracking numbers
            errors,
            total: validShipments.length, // Only count valid ones
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
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: errorMessage,
          })
        }
      }),
}
const frontRouter = {
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
        // Create sync history record
        const syncRecord = await context.prisma.sync_history.create({
          data: {
            source: 'manual',
            batch_size: input.batchSize,
            limit: input.pageSize,
            started_at: new Date(),
          },
        })
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
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
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
            // Update sync history with empty result
            await context.prisma.sync_history.update({
              where: { id: syncRecord.id },
              data: {
                completed_at: new Date(),
                status: 'success',
                conversations_processed: 0,
                conversations_already_scanned: 0,
                shipments_added: 0,
                shipments_skipped: 0,
                conversations_with_no_tracking: 0,
                duration_ms: Date.now() - startTime,
              },
            })
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
          // Uses NEXT_PUBLIC_ prefix so the same env var controls both UI visibility and backend behavior
          const isDevMode = process.env.NEXT_PUBLIC_ENABLE_FORCE_RESCAN === 'true'
          const shouldRescan = forceRescan && isDevMode
          if (shouldRescan) {
            console.log('🔄 DEV MODE: Force rescanning ALL conversations')
          }
          const conversationIds = conversations.map((c: FrontConversation) => c.id)
          // Fetch scan history with last message timestamps
          const alreadyScanned = shouldRescan
            ? []
            : await context.prisma.scanned_conversations.findMany({
                where: {
                  conversation_id: { in: conversationIds },
                },
                select: { 
                  conversation_id: true,
                  last_message_at: true,
                },
              })
          // Build map of conversation_id -> last_message_at
          const scanHistory = new Map(
            alreadyScanned.map((s) => [s.conversation_id, s.last_message_at])
          )
          // Determine which conversations need scanning
          // A conversation needs scanning if:
          // 1. Never scanned before (not in scanHistory), OR
          // 2. Force rescan enabled (shouldRescan), OR
          // 3. Has new messages since last scan (we'll check this per-conversation when fetching messages)
          const conversationsToCheck = shouldRescan
            ? conversations
            : conversations.filter((c: FrontConversation) => !scanHistory.has(c.id))
          console.log(
            `${conversationsToCheck.length} conversations never scanned, ${scanHistory.size} previously scanned (will check for updates)`
          )
          // Now process both never-scanned and potentially-updated conversations
          // We'll check for updates while processing each conversation
          const conversationsToProcess = shouldRescan
            ? conversations  // Force rescan all
            : [...conversationsToCheck] // Start with never-scanned ones
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
            skippedUpToDate: number
          }> => {
            const results = {
              added: 0,
              updated: 0,
              skipped: 0,
              noTracking: 0,
              errors: [] as string[],
              skippedUpToDate: 0,
            }
            await Promise.allSettled(
              convos.map(async (conversation) => {
                try {
                  const messages = await frontClient.getConversationMessages(conversation.id)
                  if (messages.length === 0) {
                    await context.prisma.scanned_conversations.upsert({
                      where: { conversation_id: conversation.id },
                      update: { 
                        scanned_at: new Date(),
                        last_message_at: null,
                      },
                      create: {
                        conversation_id: conversation.id,
                        subject: conversation.subject,
                        shipments_found: 0,
                        last_message_at: null,
                      },
                    })
                    results.noTracking++
                    return
                  }
                  // Get the latest message timestamp
                  const latestMessageTimestamp = Math.max(...messages.map((m: FrontMessage) => m.created_at))
                  const latestMessageDate = new Date(latestMessageTimestamp * 1000)
                  // Check if conversation has new messages since last scan
                  const lastScannedMessageAt = scanHistory.get(conversation.id)
                  if (!rescan && lastScannedMessageAt && latestMessageDate <= lastScannedMessageAt) {
                    // Conversation is up to date, skip AI extraction
                    results.skippedUpToDate++
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
                      update: { 
                        scanned_at: new Date(),
                        last_message_at: latestMessageDate,
                      },
                      create: {
                        conversation_id: conversation.id,
                        subject: conversation.subject,
                        shipments_found: 0,
                        last_message_at: latestMessageDate,
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
                      last_message_at: latestMessageDate,
                      shipments_found: results.added + results.updated,
                    },
                    create: {
                      conversation_id: conversation.id,
                      subject: conversation.subject,
                      shipments_found: results.added + results.updated,
                      last_message_at: latestMessageDate,
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
            skippedUpToDate: 0,
            alreadyScanned: scanHistory.size - conversationsToCheck.length, // Scanned but not in check list
            noTracking: 0,
            errors: [] as string[],
          }
          // Also process previously scanned conversations to check for updates
          const allConversationsToProcess = shouldRescan
            ? conversations
            : [...conversationsToCheck, ...conversations.filter((c: FrontConversation) => scanHistory.has(c.id))]
          // Process batches
          const batches: FrontConversation[][] = []
          for (let i = 0; i < allConversationsToProcess.length; i += batchSize) {
            batches.push(allConversationsToProcess.slice(i, i + batchSize))
          }
          if (shouldRescan) {
            for (let i = 0; i < batches.length; i++) {
              const batchResult = await processBatch(batches[i], forceRescan)
              results.added += batchResult.added
              results.updated += batchResult.updated
              results.skipped += batchResult.skipped
              results.skippedUpToDate += batchResult.skippedUpToDate
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
              results.skippedUpToDate += batchResult.skippedUpToDate
              results.noTracking += batchResult.noTracking
              results.errors.push(...batchResult.errors)
            }
          }
          const duration = Date.now() - startTime
          const conversationsProcessed = results.added + results.updated + results.noTracking
          const conversationsSkipped = results.skippedUpToDate + results.alreadyScanned
          console.log('=== Scan Complete ===')
          console.log(`Processed: ${conversationsProcessed}, Skipped (up-to-date): ${results.skippedUpToDate}, Already scanned: ${results.alreadyScanned}`)
          // Update sync history with results
          await context.prisma.sync_history.update({
            where: { id: syncRecord.id },
            data: {
              completed_at: new Date(),
              status: results.errors.length > 0 ? 'partial' : 'success',
              conversations_processed: conversationsProcessed,
              conversations_already_scanned: conversationsSkipped,
              shipments_added: results.added,
              shipments_skipped: results.skipped,
              conversations_with_no_tracking: results.noTracking,
              duration_ms: duration,
              errors: results.errors,
            },
          })
          return {
            success: true,
            summary: {
              conversationsProcessed,
              conversationsAlreadyScanned: conversationsSkipped,
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
          // Update sync history with error status
          await context.prisma.sync_history.update({
            where: { id: syncRecord.id },
            data: {
              completed_at: new Date(),
              status: 'error',
              duration_ms: Date.now() - startTime,
              errors: [errorMessage],
            },
          })
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: errorMessage,
          })
        }
      }),
}
const omgRouter = {
  /**
   * Get OMG data for a shipment
   */
  getShipmentData: publicProcedure
      .input(z.object({
        shipmentId: z.number(),
      }))
      .output(z.object({
        success: z.boolean(),
        data: z.object({
          poNumber: z.string(),
          orderName: z.string().nullish(),
          customerName: z.string().nullish(),
          urls: z.object({
            order: z.string(),
            purchaseOrder: z.string(),
          }),
          syncedAt: z.string(),
        }).nullish(),
        error: z.string().optional(),
      }))
      .handler(async ({ input }) => {
        const { getShipmentOmgData } = await import('@/lib/infrastructure/omg')
        
        try {
          const data = await getShipmentOmgData(input.shipmentId)
          
          if (!data) {
            return {
              success: true,
              data: null,
            }
          }
          
          return {
            success: true,
            data: {
              poNumber: data.po_number,
              orderName: data.order_name,
              customerName: data.customer_name,
              urls: data.urls,
              syncedAt: data.synced_at.toISOString(),
            },
          }
        } catch (err) {
          return {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : 'Unknown error',
          }
        }
      }),

  /**
   * Sync OMG data for a shipment
   */
  syncShipment: publicProcedure
      .input(z.object({
        shipmentId: z.number(),
      }))
      .output(z.object({
        success: z.boolean(),
        linked: z.boolean().optional(),
        error: z.string().optional(),
      }))
      .handler(async ({ input }) => {
        const { syncShipmentOmgData } = await import('@/lib/infrastructure/omg')
        
        const result = await syncShipmentOmgData(input.shipmentId)
        
        return {
          success: result.success,
          linked: result.success,
          error: result.error,
        }
      }),

  /**
   * Batch sync all unlinked shipments with OMG data
   */
  batchSync: publicProcedure
      .input(z.object({
        limit: z.number().default(50),
      }).default({ limit: 50 }))
      .output(z.object({
        success: z.boolean(),
        synced: z.number(),
        failed: z.number(),
        errors: z.array(z.object({
          poNumber: z.string(),
          error: z.string(),
        })),
      }))
      .handler(async ({ input }) => {
        const { batchSyncOmgData } = await import('@/lib/infrastructure/omg')
        
        const result = await batchSyncOmgData({ limit: input.limit })
        
        return {
          success: true,
          synced: result.synced,
          failed: result.failed,
          errors: result.errors,
        }
      }),
}

// Plain nested object structure (recommended by oRPC docs)
export const appRouter = {
  shipments: shipmentsRouter,
  trackingStats: trackingStatsRouter,
  syncHistory: syncHistoryRouter,
  manualUpdateTracking: manualUpdateTrackingRouter,
  trackers: trackersRouter,
  front: frontRouter,
  omg: omgRouter,
}
export type AppRouter = typeof appRouter
