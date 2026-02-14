import { registerEventHandler } from '@/lib/application/events/registry'
import { triggerShipmentNotification, KnockWorkflows } from '@/lib/infrastructure/notifications/knock'
import { ShipmentEventTopics } from './topics'
import type { QueuedEvent } from '@/lib/application/events/types'
import type { ShipmentEventPayload } from './buildShipmentEvents'

/**
 * Map event topics to Knock workflow keys.
 */
const topicToWorkflow: Record<string, string> = {
  [ShipmentEventTopics.Created]: KnockWorkflows.ShipmentCreated,
  [ShipmentEventTopics.StatusChanged]: KnockWorkflows.ShipmentStatusChanged,
  [ShipmentEventTopics.Delivered]: KnockWorkflows.ShipmentDelivered,
  [ShipmentEventTopics.Exception]: KnockWorkflows.ShipmentException,
}

function createHandler(topic: string) {
  return async (event: QueuedEvent<ShipmentEventPayload>) => {
    const payload = event.payload
    console.log(`[event] ${topic}`, JSON.stringify(payload))

    // Trigger Knock workflow (if configured and has recipients)
    const knockWorkflow = topicToWorkflow[topic]
    if (knockWorkflow && payload.current) {
      const recipients = getRecipientsForShipment(payload)

      await triggerShipmentNotification(knockWorkflow, recipients, {
        trackingNumber: payload.current.trackingNumber,
        status: payload.current.status,
        carrier: payload.current.carrier,
        poNumber: payload.current.poNumber,
        previousStatus: payload.previous?.status,
        estimatedDelivery: payload.current.estimatedDelivery,
        deliveredDate: payload.current.deliveredDate,
      })
    }
  }
}

/**
 * Determine who should receive notifications for a shipment event.
 *
 * TODO: Implement actual recipient lookup based on:
 * - payload.current.poNumber -> lookup order -> customer contacts
 * - Shipment metadata with contact info
 * - Account notification settings
 *
 * For now, returns empty array (no notifications sent).
 * Add recipient user IDs here to enable notifications.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getRecipientsForShipment(_payload: ShipmentEventPayload): string[] {
  // Example: return ['user-123'] to notify a specific user
  // In production: look up actual recipients from order/project data
  return []
}

export function registerShipmentEventHandlers() {
  registerEventHandler(ShipmentEventTopics.Created, createHandler(ShipmentEventTopics.Created))
  registerEventHandler(ShipmentEventTopics.Updated, createHandler(ShipmentEventTopics.Updated))
  registerEventHandler(ShipmentEventTopics.StatusChanged, createHandler(ShipmentEventTopics.StatusChanged))
  registerEventHandler(ShipmentEventTopics.Delivered, createHandler(ShipmentEventTopics.Delivered))
  registerEventHandler(ShipmentEventTopics.Exception, createHandler(ShipmentEventTopics.Exception))
}
