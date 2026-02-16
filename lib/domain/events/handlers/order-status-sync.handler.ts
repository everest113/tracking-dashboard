/**
 * Order Status Sync Event Handler
 * 
 * Automatically recomputes order status when a shipment status changes.
 * This keeps the denormalized orders table in sync with shipment data.
 */

import { domainEvents } from '../index'
import { prisma } from '@/lib/prisma'
import { getOrderSyncService } from '@/lib/infrastructure/order'

/**
 * Register the order status sync handler
 * Call this once at application startup
 */
export function registerOrderStatusSyncHandler(): void {
  const syncService = getOrderSyncService(prisma)

  // When a shipment status changes, recompute the order status
  domainEvents.on('ShipmentStatusChanged', async (payload) => {
    const { shipmentId, oldStatus, newStatus } = payload
    
    console.log(`[Order Status Sync] Shipment ${shipmentId} status changed: ${oldStatus} → ${newStatus}`)
    
    try {
      await syncService.syncByShipmentId(shipmentId)
      console.log(`[Order Status Sync] ✅ Updated order status for shipment ${shipmentId}`)
    } catch (err) {
      console.error(`[Order Status Sync] ❌ Error updating order status for shipment ${shipmentId}:`, err)
    }
  })

  // Also sync when a new shipment is created with a PO
  domainEvents.on('ShipmentCreated', async (payload) => {
    const { shipmentId, poNumber } = payload
    
    if (!poNumber) {
      return // No PO, can't determine order
    }
    
    console.log(`[Order Status Sync] New shipment ${shipmentId} created with PO ${poNumber}`)
    
    try {
      await syncService.syncByShipmentId(shipmentId)
      console.log(`[Order Status Sync] ✅ Updated order status for new shipment ${shipmentId}`)
    } catch (err) {
      console.error(`[Order Status Sync] ❌ Error updating order status for new shipment ${shipmentId}:`, err)
    }
  })

  // Sync when a PO is linked to a shipment (in case order didn't exist before)
  domainEvents.on('ShipmentPOLinked', async (payload) => {
    const { shipmentId, poNumber } = payload
    
    console.log(`[Order Status Sync] PO ${poNumber} linked to shipment ${shipmentId}`)
    
    try {
      await syncService.syncByShipmentId(shipmentId)
      console.log(`[Order Status Sync] ✅ Updated order status after PO link for shipment ${shipmentId}`)
    } catch (err) {
      console.error(`[Order Status Sync] ❌ Error updating order status after PO link for shipment ${shipmentId}:`, err)
    }
  })

  console.log('[Order Status Sync] Registered for ShipmentStatusChanged, ShipmentCreated, ShipmentPOLinked events')
}
