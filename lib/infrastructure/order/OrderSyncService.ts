/**
 * Order Sync Service
 * 
 * Synchronizes the orders table with data from omg_purchase_orders and shipments.
 * Computes denormalized status and stats for efficient server-side filtering.
 */

import type { PrismaClient } from '@prisma/client'
import { 
  OrderStatus, 
  computeOrderStatus, 
  categorizeShipmentStatus,
  type OrderShipmentStats 
} from '@/lib/domain/order'
import { createOrderRepository, type OrderRepository } from './OrderRepository'

export interface OrderSyncResult {
  created: number
  updated: number
  total: number
}

export interface OrderSyncService {
  /**
   * Sync all orders from omg_purchase_orders + shipments.
   * Creates/updates orders table with computed status.
   */
  syncAll(): Promise<OrderSyncResult>

  /**
   * Sync a single order by order number.
   * Call this when a shipment status changes.
   */
  syncOrder(orderNumber: string): Promise<{ status: OrderStatus; stats: OrderShipmentStats } | null>

  /**
   * Sync orders affected by a specific shipment.
   * Looks up the order via po_number and recomputes status.
   */
  syncByShipmentId(shipmentId: number): Promise<void>
}

export function createOrderSyncService(prisma: PrismaClient): OrderSyncService {
  const repository = createOrderRepository(prisma)

  return {
    async syncAll(): Promise<OrderSyncResult> {
      // Get all unique orders from omg_purchase_orders
      const omgOrders = await prisma.omg_purchase_orders.findMany({
        select: {
          order_number: true,
          order_name: true,
          customer_name: true,
          customer_email: true,
          omg_order_id: true,
          po_number: true,
        },
      })

      // Group by order_number (an order can have multiple POs)
      const orderMap = new Map<string, {
        orderNumber: string
        orderName: string | null
        customerName: string | null
        customerEmail: string | null
        omgOrderId: string
        poNumbers: string[]
      }>()

      for (const record of omgOrders) {
        if (!orderMap.has(record.order_number)) {
          orderMap.set(record.order_number, {
            orderNumber: record.order_number,
            orderName: record.order_name,
            customerName: record.customer_name,
            customerEmail: record.customer_email,
            omgOrderId: record.omg_order_id,
            poNumbers: [],
          })
        }
        orderMap.get(record.order_number)!.poNumbers.push(record.po_number)
      }

      // Get all shipments with their statuses
      const shipments = await prisma.shipments.findMany({
        where: { po_number: { not: null } },
        select: {
          po_number: true,
          status: true,
        },
      })

      // Build a map of normalized PO -> shipment statuses
      const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
      const poStatusMap = new Map<string, string[]>()
      
      for (const shipment of shipments) {
        if (!shipment.po_number) continue
        const normalized = normalizePoNumber(shipment.po_number)
        if (!poStatusMap.has(normalized)) {
          poStatusMap.set(normalized, [])
        }
        poStatusMap.get(normalized)!.push(shipment.status)
      }

      let created = 0
      let updated = 0

      // Upsert each order
      for (const [orderNumber, orderData] of orderMap) {
        // Compute stats from shipments
        const stats: OrderShipmentStats = {
          total: 0,
          delivered: 0,
          inTransit: 0,
          pending: 0,
          exception: 0,
        }

        for (const poNumber of orderData.poNumbers) {
          const statuses = poStatusMap.get(poNumber) || []
          for (const status of statuses) {
            stats.total++
            const category = categorizeShipmentStatus(status)
            stats[category]++
          }
        }

        const computedStatus = computeOrderStatus(stats)

        // Check if exists
        const existing = await repository.findByOrderNumber(orderNumber)

        await repository.upsert({
          orderNumber: orderData.orderNumber,
          orderName: orderData.orderName,
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          omgOrderId: orderData.omgOrderId,
          computedStatus,
          shipmentCount: stats.total,
          deliveredCount: stats.delivered,
          inTransitCount: stats.inTransit,
          pendingCount: stats.pending,
          exceptionCount: stats.exception,
        })

        if (existing) {
          updated++
        } else {
          created++
        }
      }

      return {
        created,
        updated,
        total: orderMap.size,
      }
    },

    async syncOrder(orderNumber: string): Promise<{ status: OrderStatus; stats: OrderShipmentStats } | null> {
      // Get all POs for this order
      const omgRecords = await prisma.omg_purchase_orders.findMany({
        where: { order_number: orderNumber },
        select: {
          po_number: true,
          order_name: true,
          customer_name: true,
          customer_email: true,
          omg_order_id: true,
        },
      })

      if (omgRecords.length === 0) {
        return null
      }

      const poNumbers = omgRecords.map(r => r.po_number)
      const firstRecord = omgRecords[0]

      // Get shipments for these POs
      const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
      const normalizedPOs = poNumbers

      const shipments = await prisma.shipments.findMany({
        where: { 
          po_number: { 
            in: normalizedPOs.map(po => {
              // Match both normalized and raw formats
              return po
            })
          }
        },
        select: { status: true, po_number: true },
      })

      // Also try matching with the shipment's po_number normalized
      const allShipments = await prisma.shipments.findMany({
        where: { po_number: { not: null } },
        select: { status: true, po_number: true },
      })

      const matchingShipments = allShipments.filter(s => {
        if (!s.po_number) return false
        const normalized = normalizePoNumber(s.po_number)
        return normalizedPOs.includes(normalized)
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

      const computedStatus = computeOrderStatus(stats)

      // Update the order
      await repository.upsert({
        orderNumber,
        orderName: firstRecord.order_name,
        customerName: firstRecord.customer_name,
        customerEmail: firstRecord.customer_email,
        omgOrderId: firstRecord.omg_order_id,
        computedStatus,
        shipmentCount: stats.total,
        deliveredCount: stats.delivered,
        inTransitCount: stats.inTransit,
        pendingCount: stats.pending,
        exceptionCount: stats.exception,
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

      // Find the order number via omg_purchase_orders
      const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
      const normalizedPo = normalizePoNumber(shipment.po_number)

      const omgRecord = await prisma.omg_purchase_orders.findUnique({
        where: { po_number: normalizedPo },
        select: { order_number: true },
      })

      if (!omgRecord) {
        return
      }

      // Sync the order
      await this.syncOrder(omgRecord.order_number)
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
