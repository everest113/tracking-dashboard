/**
 * OMG Sync Event Handler
 * 
 * Automatically syncs shipments with OMG Orders when a PO is linked.
 * This handler is registered at app startup and reacts to domain events.
 */

import { domainEvents } from '../index'
import { syncShipmentOmgData } from '@/lib/infrastructure/omg'

/**
 * Register the OMG sync handler
 * Call this once at application startup
 */
export function registerOmgSyncHandler(): void {
  // When a PO is linked to a shipment, sync with OMG
  domainEvents.on('ShipmentPOLinked', async (payload) => {
    const { shipmentId, poNumber } = payload
    
    console.log(`[OMG Sync Handler] Triggered for shipment ${shipmentId} (PO: ${poNumber})`)
    
    try {
      const result = await syncShipmentOmgData(shipmentId)
      
      if (result.success) {
        console.log(`[OMG Sync Handler] ✅ Synced shipment ${shipmentId} with OMG`)
      } else {
        console.log(`[OMG Sync Handler] ⚠️ Could not sync shipment ${shipmentId}: ${result.error}`)
      }
    } catch (err) {
      console.error(`[OMG Sync Handler] ❌ Error syncing shipment ${shipmentId}:`, err)
    }
  })

  // Also sync on shipment creation if it has a PO
  domainEvents.on('ShipmentCreated', async (payload) => {
    const { shipmentId, poNumber } = payload
    
    if (!poNumber) {
      return // No PO, nothing to sync
    }
    
    console.log(`[OMG Sync Handler] New shipment ${shipmentId} has PO ${poNumber}, syncing...`)
    
    try {
      const result = await syncShipmentOmgData(shipmentId)
      
      if (result.success) {
        console.log(`[OMG Sync Handler] ✅ Synced new shipment ${shipmentId} with OMG`)
      } else {
        console.log(`[OMG Sync Handler] ⚠️ Could not sync new shipment ${shipmentId}: ${result.error}`)
      }
    } catch (err) {
      console.error(`[OMG Sync Handler] ❌ Error syncing new shipment ${shipmentId}:`, err)
    }
  })

  console.log('[OMG Sync Handler] Registered for ShipmentPOLinked and ShipmentCreated events')
}
