/**
 * Audit Logging Event Handler
 * 
 * Centralized handler that logs domain events to the audit trail.
 * Listens to shipment and order events and records them for history tracking.
 */

import { domainEvents } from '../index'
import { getAuditService } from '@/lib/infrastructure/audit'
import { AuditEntityTypes, AuditActions } from '@/lib/domain/audit'
import { prisma } from '@/lib/prisma'

/**
 * Register the audit logging handler
 * Call this once at application startup
 */
export function registerAuditLoggingHandler(): void {
  const audit = getAuditService()

  // Log shipment status changes
  domainEvents.on('ShipmentStatusChanged', async (payload) => {
    const { shipmentId, oldStatus, newStatus } = payload
    
    try {
      // Get shipment details for context
      const shipment = await prisma.shipments.findUnique({
        where: { id: shipmentId },
        select: { tracking_number: true, po_number: true, carrier: true },
      })
      
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ShipmentStatusChanged,
        actor: 'system:ship24-webhook',
        metadata: {
          trackingNumber: shipment?.tracking_number,
          poNumber: shipment?.po_number,
          carrier: shipment?.carrier,
          oldStatus,
          newStatus,
        },
      })
      
      console.log(`[Audit] Logged shipment status change: ${shipmentId} (${oldStatus} → ${newStatus})`)
    } catch (err) {
      console.error(`[Audit] Failed to log shipment status change for ${shipmentId}:`, err)
    }
  })

  // Log shipment creation
  domainEvents.on('ShipmentCreated', async (payload) => {
    const { shipmentId, trackingNumber, poNumber, carrier } = payload
    
    try {
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ShipmentCreated,
        actor: 'system',
        metadata: {
          trackingNumber,
          poNumber,
          carrier,
        },
      })
      
      console.log(`[Audit] Logged shipment creation: ${shipmentId} (${trackingNumber})`)
    } catch (err) {
      console.error(`[Audit] Failed to log shipment creation for ${shipmentId}:`, err)
    }
  })

  // Log tracker registration
  domainEvents.on('ShipmentTrackerRegistered', async (payload) => {
    const { shipmentId, trackingNumber, trackerId } = payload
    
    try {
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ShipmentTrackerRegistered,
        actor: 'system:ship24',
        metadata: {
          trackingNumber,
          trackerId,
        },
      })
      
      console.log(`[Audit] Logged tracker registration: ${shipmentId} (tracker: ${trackerId})`)
    } catch (err) {
      console.error(`[Audit] Failed to log tracker registration for ${shipmentId}:`, err)
    }
  })

  // Log tracker registration failure
  domainEvents.on('ShipmentTrackerFailed', async (payload) => {
    const { shipmentId, trackingNumber, error } = payload
    
    try {
      await audit.recordFailure({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ShipmentTrackerFailed,
        actor: 'system:ship24',
        error,
        metadata: {
          trackingNumber,
        },
      })
      
      console.log(`[Audit] Logged tracker failure: ${shipmentId} (${error})`)
    } catch (err) {
      console.error(`[Audit] Failed to log tracker failure for ${shipmentId}:`, err)
    }
  })

  // Log order status changes (from recomputation)
  domainEvents.on('OrderStatusChanged', async (payload) => {
    const { orderNumber, oldStatus, newStatus, trigger } = payload
    
    try {
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Order,
        entityId: orderNumber,
        action: AuditActions.OrderStatusChanged,
        actor: trigger === 'shipment_change' ? 'system:status-sync' : 'system',
        metadata: {
          oldStatus,
          newStatus,
          trigger,
        },
      })
      
      console.log(`[Audit] Logged order status change: ${orderNumber} (${oldStatus} → ${newStatus})`)
    } catch (err) {
      console.error(`[Audit] Failed to log order status change for ${orderNumber}:`, err)
    }
  })

  // Log order sync from OMG
  domainEvents.on('OrderSynced', async (payload) => {
    const { orderNumber, created, posCount } = payload
    
    try {
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Order,
        entityId: orderNumber,
        action: created ? AuditActions.OrderCreated : AuditActions.OrderSynced,
        actor: 'system:omg-sync',
        metadata: {
          created,
          posCount,
        },
      })
      
      console.log(`[Audit] Logged order ${created ? 'creation' : 'sync'}: ${orderNumber}`)
    } catch (err) {
      console.error(`[Audit] Failed to log order sync for ${orderNumber}:`, err)
    }
  })

  console.log('[Audit Logging] Registered handlers for shipment and order events')
}
