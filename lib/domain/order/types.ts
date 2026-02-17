/**
 * Order Domain Types
 * 
 * Orders are an aggregate that groups shipments by order number.
 * The computed_status is derived from the shipment statuses.
 */

/**
 * Order-level status derived from shipment statuses.
 * Stored denormalized for efficient server-side filtering.
 */
export enum OrderStatus {
  /** All shipments pending */
  Pending = 'pending',
  /** Any shipment in transit, none delivered yet */
  InTransit = 'in_transit',
  /** Some shipments delivered, some not */
  PartiallyDelivered = 'partially_delivered',
  /** All shipments delivered */
  Delivered = 'delivered',
  /** Any shipment has an exception (takes priority) */
  Exception = 'exception',
}

/**
 * Shipment stats used to compute order status
 */
export interface OrderShipmentStats {
  total: number
  delivered: number
  inTransit: number
  pending: number
  exception: number
}

/**
 * Compute order status from shipment stats.
 * Priority: Exception > Delivered > PartiallyDelivered > InTransit > Pending
 */
export function computeOrderStatus(stats: OrderShipmentStats): OrderStatus {
  // Exception takes priority - needs attention
  if (stats.exception > 0) {
    return OrderStatus.Exception
  }
  
  // All delivered
  if (stats.delivered === stats.total && stats.total > 0) {
    return OrderStatus.Delivered
  }
  
  // Some delivered
  if (stats.delivered > 0) {
    return OrderStatus.PartiallyDelivered
  }
  
  // Any in transit
  if (stats.inTransit > 0) {
    return OrderStatus.InTransit
  }
  
  // Default to pending
  return OrderStatus.Pending
}

/**
 * Order aggregate
 */
export interface Order {
  orderNumber: string
  orderName: string | null
  customerName: string | null
  customerEmail: string | null
  omgOrderId: string
  computedStatus: OrderStatus
  // OMG status fields
  omgApprovalStatus: string | null
  omgOperationsStatus: string | null
  inHandsDate: Date | null
  poCount: number
  lastSyncedAt: Date | null
  // Shipment stats
  shipmentCount: number
  deliveredCount: number
  inTransitCount: number
  pendingCount: number
  exceptionCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Map shipment status string to stats category
 */
export function categorizeShipmentStatus(status: string): keyof Omit<OrderShipmentStats, 'total'> {
  switch (status) {
    case 'delivered':
      return 'delivered'
    case 'in_transit':
    case 'out_for_delivery':
      return 'inTransit'
    case 'exception':
    case 'failed_attempt':
      return 'exception'
    default:
      return 'pending'
  }
}
