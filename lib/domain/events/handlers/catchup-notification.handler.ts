/**
 * Catch-up Notification Handler
 * 
 * When a thread is linked to an order (manually or auto-matched),
 * checks for shipment status changes that occurred before the thread
 * was linked and triggers catch-up notifications.
 */

import { domainEvents } from '../index'
import { prisma } from '@/lib/prisma'
import { getNotificationService } from '@/lib/infrastructure/notifications/knock'

/** Knock workflow for customer notifications */
const CUSTOMER_NOTIFICATION_WORKFLOW = 'customer-tracking-update'

/** Status priority for determining which notification to send */
const STATUS_PRIORITY: Record<string, number> = {
  'pending': 0,
  'pre_transit': 1,
  'in_transit': 2,
  'out_for_delivery': 3,
  'delivered': 4,
  'exception': 5, // Exception can happen at any point
}

/** Map shipment status to notification type */
function getNotificationType(status: string): 'shipped' | 'out_for_delivery' | 'delivered' | 'exception' | null {
  const statusLower = status.toLowerCase()
  
  if (statusLower === 'delivered') return 'delivered'
  if (statusLower === 'out_for_delivery' || statusLower === 'out for delivery') return 'out_for_delivery'
  if (statusLower === 'exception' || statusLower === 'delivery_exception') return 'exception'
  if (statusLower === 'in_transit' || statusLower === 'shipped') return 'shipped'
  
  return null
}

/**
 * Check if a notification was already sent for this shipment + status
 */
async function wasNotificationSent(shipmentId: number, notificationType: string): Promise<boolean> {
  const existing = await prisma.audit_history.findFirst({
    where: {
      entity_type: 'shipment',
      entity_id: String(shipmentId),
      action: 'notification.sent',
      status: 'success',
      // Check metadata for notification type
      metadata: {
        path: ['notificationType'],
        equals: notificationType,
      },
    },
  })
  
  return existing !== null
}

/**
 * Register the catch-up notification handler
 */
export function registerCatchupNotificationHandler(): void {
  domainEvents.on('ThreadLinked', async (payload) => {
    const { orderNumber, conversationId, matchType } = payload
    
    console.log(`[Catch-up Notifications] Thread linked for order ${orderNumber} (${matchType})`)
    
    try {
      // 1. Find all POs for this order
      const purchaseOrders = await prisma.purchase_orders.findMany({
        where: { order_number: orderNumber },
        select: { po_number: true },
      })
      
      if (purchaseOrders.length === 0) {
        console.log(`[Catch-up Notifications] No POs found for order ${orderNumber}`)
        return
      }
      
      const poNumbers = purchaseOrders.map(po => po.po_number)
      
      // 2. Find all shipments for these POs
      const shipments = await prisma.shipments.findMany({
        where: {
          po_number: { in: poNumbers },
        },
        select: {
          id: true,
          tracking_number: true,
          status: true,
          po_number: true,
        },
      })
      
      if (shipments.length === 0) {
        console.log(`[Catch-up Notifications] No shipments found for order ${orderNumber}`)
        return
      }
      
      console.log(`[Catch-up Notifications] Found ${shipments.length} shipment(s) for order ${orderNumber}`)
      
      // 3. Check each shipment for missed notifications
      const notificationService = getNotificationService()
      let catchupCount = 0
      
      for (const shipment of shipments) {
        const notificationType = getNotificationType(shipment.status)
        
        if (!notificationType) {
          console.log(`[Catch-up Notifications] Shipment ${shipment.id} status '${shipment.status}' doesn't need notification`)
          continue
        }
        
        // Check if notification was already sent
        const alreadySent = await wasNotificationSent(shipment.id, notificationType)
        
        if (alreadySent) {
          console.log(`[Catch-up Notifications] Shipment ${shipment.id} already has '${notificationType}' notification`)
          continue
        }
        
        // Trigger catch-up notification via Knock
        console.log(`[Catch-up Notifications] Sending catch-up '${notificationType}' for shipment ${shipment.id}`)
        
        const result = await notificationService.triggerForObject(
          CUSTOMER_NOTIFICATION_WORKFLOW,
          'shipments',
          String(shipment.id),
          {
            shipmentId: shipment.id,
            notificationType,
            isCatchup: true, // Flag for audit/debugging
          },
          {
            idempotencyKey: `catchup:${orderNumber}:${shipment.id}:${notificationType}:${Date.now()}`,
            cancellationKey: `customer:shipment:${shipment.id}`,
          }
        )
        
        if (result.success) {
          catchupCount++
        } else {
          console.error(`[Catch-up Notifications] Failed for shipment ${shipment.id}:`, result.error)
        }
      }
      
      console.log(`[Catch-up Notifications] Sent ${catchupCount} catch-up notification(s) for order ${orderNumber}`)
      
    } catch (error) {
      console.error(`[Catch-up Notifications] Error processing order ${orderNumber}:`, error)
    }
  })
  
  console.log('[Catch-up Notifications] Registered handler for ThreadLinked events')
}
