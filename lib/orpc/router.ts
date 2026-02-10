import { publicProcedure } from './base'
import { z } from 'zod'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { Prisma } from '@prisma/client'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import {
  ShipmentListQuerySchema,
  createPaginatedResponseSchema,
  buildShipmentWhereClause,
  buildShipmentOrderByClause,
} from './schemas'
import { serializeShipments } from '@/lib/infrastructure/repositories/serializers'

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

export const appRouter = {
  shipments: {
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

        return {
          items: serialized.map(s => ({
            ...s,
            shippedDate: s.shippedDate?.toISOString() ?? null,
            estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
            deliveredDate: s.deliveredDate?.toISOString() ?? null,
            ship24LastUpdate: s.ship24LastUpdate?.toISOString() ?? null,
            lastChecked: s.lastChecked?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            trackingEvents: s.trackingEvents?.map(e => ({
              ...e,
              eventTime: e.eventTime?.toISOString() ?? null,
            })),
          })),
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
      .output(z.unknown())
      .handler(async ({ context, input }) => {
        const existingShipment = await context.prisma.shipments.findUnique({
          where: { tracking_number: input.trackingNumber },
        })

        if (existingShipment) {
          throw new Error('A shipment with this tracking number already exists')
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
        })

        return shipment
      }),
  },
  trackingStats: {
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
  },
  syncHistory: {
    get: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).default({ limit: 10 }))
      .output(z.object({
        success: z.boolean(),
        history: z.array(z.unknown()),
        lastSync: z.unknown().nullable(),
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
          errors: Array.isArray(record.errors) ? record.errors : [],
        })

        return {
          success: true,
          history: historyRecords.map(mapRecord),
          lastSync: lastSyncRecord ? mapRecord(lastSyncRecord) : null,
        }
      }),
  },
  manualUpdateTracking: {
    update: publicProcedure
      .output(z.object({
        success: z.boolean(),
        checked: z.number(),
        updated: z.number(),
        errors: z.number(),
        message: z.string().optional(),
      }))
      .handler(async () => {
        return {
          success: true,
          checked: 0,
          updated: 0,
          errors: 0,
          message: 'Use /api/manual-update-tracking for full functionality',
        }
      }),
  },
} as const

export type AppRouter = typeof appRouter
