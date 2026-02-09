import { os } from '@orpc/server'
import { publicProcedure } from './base'
import { z } from 'zod'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

export const appRouter = os.router({
  shipments: {
    list: publicProcedure
      .output(z.array(z.any()))
      .handler(async ({ context }) => {
        const shipments = await context.prisma.shipments.findMany({
          orderBy: { created_at: 'desc' },
          take: 100,
        })
        return shipments
      }),

    create: publicProcedure
      .input(shipmentSchema)
      .output(z.any())
      .handler(async ({ context, input }) => {
        const existingShipment = await context.prisma.shipments.findUnique({
          where: { tracking_number: input.trackingNumber },
        })

        if (existingShipment) {
          throw new Error('A shipment with this tracking number already exists')
        }

        const shipmentData: any = {
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
        } catch (trackerError: any) {
          console.warn(`⚠️  Failed to register tracker for ${input.trackingNumber}:`, trackerError.message)
        }

        const shipment = await context.prisma.shipments.create({
          data: shipmentData,
        })

        return shipment
      }),
  } as any,

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
  } as any,

  syncHistory: {
    get: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).default({ limit: 10 }))
      .output(z.object({
        success: z.boolean(),
        history: z.array(z.any()),
        lastSync: z.any().nullable(),
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

        const mapRecord = (record: any) => ({
          id: record.id,
          startedAt: record.started_at,
          completedAt: record.completed_at,
          status: record.status,
          conversationsProcessed: record.conversations_processed,
          shipmentsAdded: record.shipments_added,
          errors: record.errors,
        })

        return {
          success: true,
          history: historyRecords.map(mapRecord),
          lastSync: lastSyncRecord ? mapRecord(lastSyncRecord) : null,
        }
      }),
  } as any,

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
  } as any,
})

export type AppRouter = typeof appRouter
