/**
 * Customer Notification Handler
 * 
 * Triggers Knock workflow for customer tracking notifications.
 * Knock then calls our webhook which sends via Front.
 * 
 * This runs in parallel with the internal team notification handlers.
 * 
 * In local development (no KNOCK_API_KEY), bypasses Knock and calls
 * TrackingNotificationService directly.
 */

import { registerEventHandler } from '@/lib/application/events/registry'
import { getNotificationService, isKnockConfigured } from '@/lib/infrastructure/notifications/knock'
import { getTrackingNotificationService } from '@/lib/infrastructure/customer-thread'
import { ShipmentEventTopics } from './topics'
import type { QueuedEvent } from '@/lib/application/events/types'
import type { ShipmentEventPayload } from './buildShipmentEvents'

/**
 * Knock workflow for customer notifications.
 * This workflow has an HTTP fetch step that calls:
 * POST /api/webhooks/knock/customer-notification
 */
const CUSTOMER_NOTIFICATION_WORKFLOW = 'customer-tracking-update'

/**
 * Map shipment status to notification type.
 */
function getNotificationType(
  status: string,
  previousStatus?: string | null
): 'shipped' | 'out_for_delivery' | 'delivered' | 'exception' | null {
  const statusLower = status.toLowerCase()
  
  if (statusLower === 'delivered') {
    return 'delivered'
  }
  
  if (statusLower === 'out_for_delivery' || statusLower === 'out for delivery') {
    return 'out_for_delivery'
  }
  
  if (statusLower === 'exception' || statusLower === 'delivery_exception') {
    return 'exception'
  }
  
  // "shipped" is for initial shipment - only if previous was pending/null
  if (
    (statusLower === 'in_transit' || statusLower === 'shipped') &&
    (!previousStatus || previousStatus.toLowerCase() === 'pending')
  ) {
    return 'shipped'
  }
  
  // Other status changes don't trigger customer notifications
  return null
}

/**
 * Trigger customer notification.
 * 
 * If Knock is configured, triggers via Knock workflow (production/staging).
 * If not, calls TrackingNotificationService directly (local development).
 */
async function triggerCustomerNotification(
  shipmentId: number,
  notificationType: 'shipped' | 'out_for_delivery' | 'delivered' | 'exception',
  eventId: string,
  exceptionReason?: string
): Promise<void> {
  // In local development, bypass Knock and send directly
  if (!isKnockConfigured()) {
    console.log(`[Customer Notification] Knock not configured, sending directly`)
    const trackingService = getTrackingNotificationService()
    const result = await trackingService.sendNotification({
      shipmentId,
      notificationType,
      exceptionReason,
    })
    
    if (result.success) {
      console.log(`[Customer Notification] Sent ${notificationType} for shipment ${shipmentId}`)
    } else if (result.skippedReason) {
      console.log(`[Customer Notification] Skipped: ${result.skippedReason}`)
    } else {
      console.error(`[Customer Notification] Failed: ${result.error}`)
    }
    return
  }
  
  // Production/staging: trigger via Knock for idempotency
  const notificationService = getNotificationService()
  
  const result = await notificationService.triggerForObject(
    CUSTOMER_NOTIFICATION_WORKFLOW,
    'shipments',
    String(shipmentId),
    {
      shipmentId,
      notificationType,
      exceptionReason,
    },
    {
      // Idempotency: same event + shipment + type = same notification
      idempotencyKey: `customer:${eventId}:${shipmentId}:${notificationType}`,
      cancellationKey: `customer:shipment:${shipmentId}`,
    }
  )
  
  if (result.success) {
    console.log(`[Customer Notification] Triggered ${notificationType} for shipment ${shipmentId}`)
  } else {
    console.error(`[Customer Notification] Failed to trigger for shipment ${shipmentId}:`, result.error)
  }
}

/**
 * Handler for shipment.status.changed events.
 */
async function handleStatusChanged(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  
  if (!payload?.current) return
  
  const notificationType = getNotificationType(
    payload.current.status,
    payload.previous?.status
  )
  
  if (!notificationType) {
    console.log(`[Customer Notification] No notification for status change: ${payload.previous?.status} → ${payload.current.status}`)
    return
  }
  
  await triggerCustomerNotification(
    payload.current.shipmentId,
    notificationType,
    event.id
  )
}

/**
 * Handler for shipment.delivered events.
 */
async function handleDelivered(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  
  if (!payload?.current) return
  
  await triggerCustomerNotification(
    payload.current.shipmentId,
    'delivered',
    event.id
  )
}

/**
 * Handler for shipment.exception events.
 */
async function handleException(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  
  if (!payload?.current) return
  
  // TODO: Extract exception reason from tracking events if available
  await triggerCustomerNotification(
    payload.current.shipmentId,
    'exception',
    event.id
  )
}

/**
 * Register customer notification handlers.
 * Call this from registerEventHandlers.
 * 
 * Note: The registry now supports multiple handlers per topic,
 * so these run in parallel with the internal team handlers.
 */
export function registerCustomerNotificationHandlers(): void {
  registerEventHandler(ShipmentEventTopics.StatusChanged, handleStatusChanged)
  registerEventHandler(ShipmentEventTopics.Delivered, handleDelivered)
  registerEventHandler(ShipmentEventTopics.Exception, handleException)
  
  console.log('[Customer Notification] Registered handlers for shipment events')
}
