import { registerEventHandler } from '@/lib/application/events/registry'
import { evaluateAndEnqueue } from '@/lib/application/notifications/evaluateRules'
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

    // 1. Evaluate our internal notification rules and queue
    const result = await evaluateAndEnqueue(topic, event.id, payload as Record<string, unknown>)
    if (result.notificationsQueued > 0) {
      console.log(`[event] ${topic} -> queued ${result.notificationsQueued} internal notifications`)
    }

    // 2. Trigger Knock workflow (if configured and relevant)
    const knockWorkflow = topicToWorkflow[topic]
    if (knockWorkflow && payload.current) {
      // For now, we'll use a placeholder recipient
      // In production, you'd look up the actual users to notify based on the shipment
      const recipients = getRecipientsForShipment(payload)
      
      if (recipients.length > 0) {
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
}

/**
 * Determine who should receive notifications for a shipment event.
 * 
 * TODO: In production, this would look up:
 * - Customer contacts from the order/project
 * - Account CSM/rep
 * - Subscription preferences
 * 
 * For now, returns a placeholder or empty array.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getRecipientsForShipment(_payload: ShipmentEventPayload): string[] {
  // Placeholder: In production, look up actual users to notify
  // Could be based on:
  // - payload.current.poNumber -> lookup order -> customer email
  // - Shipment metadata with contact info
  // - Account settings for notifications
  
  // For development/testing, return empty to skip Knock triggers
  // Or return a test user ID if you want to test
  return []
}

export function registerShipmentEventHandlers() {
  registerEventHandler(ShipmentEventTopics.Created, createHandler(ShipmentEventTopics.Created))
  registerEventHandler(ShipmentEventTopics.Updated, createHandler(ShipmentEventTopics.Updated))
  registerEventHandler(ShipmentEventTopics.StatusChanged, createHandler(ShipmentEventTopics.StatusChanged))
  registerEventHandler(ShipmentEventTopics.Delivered, createHandler(ShipmentEventTopics.Delivered))
  registerEventHandler(ShipmentEventTopics.Exception, createHandler(ShipmentEventTopics.Exception))
}
