/**
 * Domain types for shipment notifications.
 */

export type ShipmentObjectData = {
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  supplier: string | null
  estimatedDelivery: string | null
  deliveredDate: string | null
  shippedDate: string | null
}

export type ShipmentNotificationData = {
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  previousStatus?: string | null
  estimatedDelivery?: string | null
  deliveredDate?: string | null
}

/**
 * Workflow keys for shipment notifications.
 */
export const ShipmentWorkflows = {
  Created: 'shipment-created',
  StatusChanged: 'shipment-status-changed',
  Delivered: 'shipment-delivered',
  Exception: 'shipment-exception',
} as const

export type ShipmentWorkflow = typeof ShipmentWorkflows[keyof typeof ShipmentWorkflows]

/**
 * Collection name for shipment objects.
 */
export const SHIPMENTS_COLLECTION = 'shipments'
