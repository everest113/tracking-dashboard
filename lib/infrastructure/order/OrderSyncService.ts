/**
 * Order Sync Service
 * 
 * Recomputes order stats (shipment counts, computed status) based on shipments.
 * Orders are created by OmgOrderSyncService - this service only updates stats.
 */

import type { PrismaClient } from '@prisma/client'
import { 
  OrderStatus, 
  computeOrderStatus, 
  categorizeShipmentStatus,
  type OrderShipmentStats 
} from '@/lib/domain/order'

export interface OrderSyncResult {
  created: number  // Always 0 in new architecture
  updated: number
  total: number
}

export interface OrderSyncService {
  /**
   * Recompute stats for all orders based on shipments.
   * Uses purchase_orders table to link shipments to orders.
   */
  syncAll(): Promise<OrderSyncResult>

  /**
   * Recompute stats for a single order.
   */
  syncOrder(orderNumber: string): Promise<{ status: OrderStatus; stats: OrderShipmentStats } | null>

  /**
   * Sync orders affected by a specific shipment.
   * Looks up the order via po_number and recomputes stats.
   */
  syncByShipmentId(shipmentId: number): Promise<void>
}

export function createOrderSyncService(prisma: PrismaClient): OrderSyncService {
  const { normalizePoNumber } = require('@/lib/infrastructure/omg/sync')

  /**
   * Get shipment stats for an order by looking up its POs
   */
  async function getOrderStats(orderNumber: string): Promise<OrderShipmentStats> {
    // Get all POs for this order
    const pos = await prisma.purchase_orders.findMany({
      where: { order_number: orderNumber },
      select: { po_number: true },
    })
    
    const poNumbers = pos.map(p => p.po_number)
    
    // Get shipments matching these POs
    const shipments = await prisma.shipments.findMany({
      where: { po_number: { not: null } },
      select: { po_number: true, status: true },
    })
    
    // Filter to shipments matching our POs
    const normalizedPOs = new Set(poNumbers.map(po => normalizePoNumber(po)))
    const matchingShipments = shipments.filter(s => {
      if (!s.po_number) return false
      return normalizedPOs.has(normalizePoNumber(s.po_number))
    })
    
    // Compute stats
    const stats: OrderShipmentStats = {
      total: 0,
      delivered: 0,
      inTransit: 0,
      pending: 0,
      exception: 0,
    }
    
    for (const shipment of matchingShipments) {
      stats.total++
      const category = categorizeShipmentStatus(shipment.status)
      stats[category]++
    }
    
    return stats
  }

  return {
    async syncAll(): Promise<OrderSyncResult> {
      // Get all orders from the orders table
      const orders = await prisma.orders.findMany({
        select: { order_number: true },
      })
      
      let updated = 0
      
      for (const order of orders) {
        const stats = await getOrderStats(order.order_number)
        const computedStatus = computeOrderStatus(stats)
        
        // Map to Prisma enum
        const prismaStatus = {
          [OrderStatus.Pending]: 'pending' as const,
          [OrderStatus.InTransit]: 'in_transit' as const,
          [OrderStatus.PartiallyDelivered]: 'partially_delivered' as const,
          [OrderStatus.Delivered]: 'delivered' as const,
          [OrderStatus.Exception]: 'exception' as const,
        }[computedStatus]
        
        await prisma.orders.update({
          where: { order_number: order.order_number },
          data: {
            computed_status: prismaStatus,
            shipment_count: stats.total,
            delivered_count: stats.delivered,
            in_transit_count: stats.inTransit,
            pending_count: stats.pending,
            exception_count: stats.exception,
          },
        })
        
        updated++
      }
      
      return {
        created: 0, // Orders are created by OmgOrderSyncService
        updated,
        total: orders.length,
      }
    },

    async syncOrder(orderNumber: string): Promise<{ status: OrderStatus; stats: OrderShipmentStats } | null> {
      // Check if order exists
      const order = await prisma.orders.findUnique({
        where: { order_number: orderNumber },
      })
      
      if (!order) {
        return null
      }
      
      const stats = await getOrderStats(orderNumber)
      const computedStatus = computeOrderStatus(stats)
      
      // Map to Prisma enum
      const prismaStatus = {
        [OrderStatus.Pending]: 'pending' as const,
        [OrderStatus.InTransit]: 'in_transit' as const,
        [OrderStatus.PartiallyDelivered]: 'partially_delivered' as const,
        [OrderStatus.Delivered]: 'delivered' as const,
        [OrderStatus.Exception]: 'exception' as const,
      }[computedStatus]
      
      await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          computed_status: prismaStatus,
          shipment_count: stats.total,
          delivered_count: stats.delivered,
          in_transit_count: stats.inTransit,
          pending_count: stats.pending,
          exception_count: stats.exception,
        },
      })
      
      return { status: computedStatus, stats }
    },

    async syncByShipmentId(shipmentId: number): Promise<void> {
      // Get the shipment's PO number
      const shipment = await prisma.shipments.findUnique({
        where: { id: shipmentId },
        select: { po_number: true },
      })

      if (!shipment?.po_number) {
        return
      }

      const normalizedPo = normalizePoNumber(shipment.po_number)

      // Find the order via purchase_orders table
      const orderRecord = await prisma.purchase_orders.findUnique({
        where: { po_number: normalizedPo },
        select: { order_number: true },
      })
      
      if (!orderRecord) {
        return
      }

      // Sync the order
      await this.syncOrder(orderRecord.order_number)
    },
  }
}

// Singleton
let instance: OrderSyncService | null = null

export function getOrderSyncService(prisma: PrismaClient): OrderSyncService {
  if (!instance) {
    instance = createOrderSyncService(prisma)
  }
  return instance
}
