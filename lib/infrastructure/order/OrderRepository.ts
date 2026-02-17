/**
 * Order Repository
 * 
 * Handles persistence for the orders aggregate.
 * Orders are synced directly from OMG and linked to purchase_orders.
 */

import type { PrismaClient, OrderComputedStatus, Prisma } from '@prisma/client'
import { OrderStatus, type Order } from '@/lib/domain/order'

/**
 * Map Prisma enum to domain enum
 */
function mapPrismaStatus(status: OrderComputedStatus): OrderStatus {
  const mapping: Record<OrderComputedStatus, OrderStatus> = {
    pending: OrderStatus.Pending,
    in_transit: OrderStatus.InTransit,
    partially_delivered: OrderStatus.PartiallyDelivered,
    delivered: OrderStatus.Delivered,
    exception: OrderStatus.Exception,
  }
  return mapping[status]
}

/**
 * Map domain enum to Prisma enum
 */
function mapDomainStatus(status: OrderStatus): OrderComputedStatus {
  const mapping: Record<OrderStatus, OrderComputedStatus> = {
    [OrderStatus.Pending]: 'pending',
    [OrderStatus.InTransit]: 'in_transit',
    [OrderStatus.PartiallyDelivered]: 'partially_delivered',
    [OrderStatus.Delivered]: 'delivered',
    [OrderStatus.Exception]: 'exception',
  }
  return mapping[status]
}

/**
 * Map Prisma record to domain Order
 */
function mapToOrder(record: {
  order_number: string
  order_name: string | null
  customer_name: string | null
  customer_email: string | null
  omg_order_id: string
  computed_status: OrderComputedStatus
  omg_approval_status: string | null
  omg_operations_status: string | null
  in_hands_date: Date | null
  po_count: number
  last_synced_at: Date | null
  shipment_count: number
  delivered_count: number
  in_transit_count: number
  pending_count: number
  exception_count: number
  created_at: Date
  updated_at: Date
}): Order {
  return {
    orderNumber: record.order_number,
    orderName: record.order_name,
    customerName: record.customer_name,
    customerEmail: record.customer_email,
    omgOrderId: record.omg_order_id,
    computedStatus: mapPrismaStatus(record.computed_status),
    omgApprovalStatus: record.omg_approval_status,
    omgOperationsStatus: record.omg_operations_status,
    inHandsDate: record.in_hands_date,
    poCount: record.po_count,
    lastSyncedAt: record.last_synced_at,
    shipmentCount: record.shipment_count,
    deliveredCount: record.delivered_count,
    inTransitCount: record.in_transit_count,
    pendingCount: record.pending_count,
    exceptionCount: record.exception_count,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export interface OrderListFilter {
  status?: OrderStatus
  search?: string
  customerEmail?: string
  needsThreadReview?: boolean
}

export interface OrderListOptions {
  filter?: OrderListFilter
  limit?: number
  offset?: number
}

export interface OrderRepository {
  findByOrderNumber(orderNumber: string): Promise<Order | null>
  list(options?: OrderListOptions): Promise<{ orders: Order[]; total: number }>
  upsert(order: Omit<Order, 'createdAt' | 'updatedAt'>): Promise<Order>
  updateStats(orderNumber: string, status: OrderStatus, stats: {
    shipmentCount: number
    deliveredCount: number
    inTransitCount: number
    pendingCount: number
    exceptionCount: number
  }): Promise<Order | null>
  updateStatus(orderNumber: string, status: OrderStatus, stats: {
    shipmentCount: number
    deliveredCount: number
    inTransitCount: number
    pendingCount: number
    exceptionCount: number
  }): Promise<Order>
  count(filter?: OrderListFilter): Promise<number>
  countByStatus(): Promise<Record<OrderStatus | 'all', number>>
  countPendingThreadReviews(): Promise<number>
}

export function createOrderRepository(prisma: PrismaClient): OrderRepository {
  return {
    async findByOrderNumber(orderNumber: string): Promise<Order | null> {
      const record = await prisma.orders.findUnique({
        where: { order_number: orderNumber },
      })
      return record ? mapToOrder(record) : null
    },

    async list(options: OrderListOptions = {}): Promise<{ orders: Order[]; total: number }> {
      const { filter, limit = 100, offset = 0 } = options

      // Build where clause
      const where: Prisma.ordersWhereInput = {}

      if (filter?.status) {
        where.computed_status = mapDomainStatus(filter.status)
      }

      if (filter?.customerEmail) {
        where.customer_email = filter.customerEmail
      }

      if (filter?.search) {
        where.OR = [
          { order_number: { contains: filter.search, mode: 'insensitive' } },
          { order_name: { contains: filter.search, mode: 'insensitive' } },
          { customer_name: { contains: filter.search, mode: 'insensitive' } },
          { customer_email: { contains: filter.search, mode: 'insensitive' } },
        ]
      }

      if (filter?.needsThreadReview) {
        where.thread_match_status = 'pending_review'
      }

      const [records, total] = await Promise.all([
        prisma.orders.findMany({
          where,
          orderBy: { order_number: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.orders.count({ where }),
      ])

      return {
        orders: records.map(mapToOrder),
        total,
      }
    },

    async upsert(order: Omit<Order, 'createdAt' | 'updatedAt'>): Promise<Order> {
      const record = await prisma.orders.upsert({
        where: { order_number: order.orderNumber },
        create: {
          order_number: order.orderNumber,
          order_name: order.orderName,
          customer_name: order.customerName,
          customer_email: order.customerEmail,
          omg_order_id: order.omgOrderId,
          computed_status: mapDomainStatus(order.computedStatus),
          shipment_count: order.shipmentCount,
          delivered_count: order.deliveredCount,
          in_transit_count: order.inTransitCount,
          pending_count: order.pendingCount,
          exception_count: order.exceptionCount,
        },
        update: {
          order_name: order.orderName,
          customer_name: order.customerName,
          customer_email: order.customerEmail,
          computed_status: mapDomainStatus(order.computedStatus),
          shipment_count: order.shipmentCount,
          delivered_count: order.deliveredCount,
          in_transit_count: order.inTransitCount,
          pending_count: order.pendingCount,
          exception_count: order.exceptionCount,
        },
      })
      return mapToOrder(record)
    },

    async updateStats(orderNumber: string, status: OrderStatus, stats: {
      shipmentCount: number
      deliveredCount: number
      inTransitCount: number
      pendingCount: number
      exceptionCount: number
    }): Promise<Order | null> {
      // Only update if order exists (orders are created by OmgOrderSyncService)
      const existing = await prisma.orders.findUnique({
        where: { order_number: orderNumber },
      })
      if (!existing) return null
      
      const record = await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          computed_status: mapDomainStatus(status),
          shipment_count: stats.shipmentCount,
          delivered_count: stats.deliveredCount,
          in_transit_count: stats.inTransitCount,
          pending_count: stats.pendingCount,
          exception_count: stats.exceptionCount,
        },
      })
      return mapToOrder(record)
    },

    // Legacy method - kept for backwards compat
    async updateStatus(orderNumber: string, status: OrderStatus, stats: {
      shipmentCount: number
      deliveredCount: number
      inTransitCount: number
      pendingCount: number
      exceptionCount: number
    }): Promise<Order> {
      const record = await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          computed_status: mapDomainStatus(status),
          shipment_count: stats.shipmentCount,
          delivered_count: stats.deliveredCount,
          in_transit_count: stats.inTransitCount,
          pending_count: stats.pendingCount,
          exception_count: stats.exceptionCount,
        },
      })
      return mapToOrder(record)
    },

    async count(filter?: OrderListFilter): Promise<number> {
      const where: Prisma.ordersWhereInput = {}

      if (filter?.status) {
        where.computed_status = mapDomainStatus(filter.status)
      }

      if (filter?.search) {
        where.OR = [
          { order_number: { contains: filter.search, mode: 'insensitive' } },
          { order_name: { contains: filter.search, mode: 'insensitive' } },
          { customer_name: { contains: filter.search, mode: 'insensitive' } },
          { customer_email: { contains: filter.search, mode: 'insensitive' } },
        ]
      }

      return prisma.orders.count({ where })
    },

    async countByStatus(): Promise<Record<OrderStatus | 'all', number>> {
      const results = await prisma.orders.groupBy({
        by: ['computed_status'],
        _count: true,
      })

      const counts: Record<OrderStatus | 'all', number> = {
        all: 0,
        [OrderStatus.Pending]: 0,
        [OrderStatus.InTransit]: 0,
        [OrderStatus.PartiallyDelivered]: 0,
        [OrderStatus.Delivered]: 0,
        [OrderStatus.Exception]: 0,
      }

      for (const result of results) {
        const status = mapPrismaStatus(result.computed_status)
        counts[status] = result._count
        counts.all += result._count
      }

      return counts
    },

    async countPendingThreadReviews(): Promise<number> {
      return prisma.orders.count({
        where: { thread_match_status: 'pending_review' },
      })
    },
  }
}
