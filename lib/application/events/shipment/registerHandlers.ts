import { registerEventHandler } from '@/lib/application/events/registry'
import { evaluateAndEnqueue } from '@/lib/application/notifications/evaluateRules'
import { ShipmentEventTopics } from './topics'
import type { QueuedEvent } from '@/lib/application/events/types'

function createHandler(topic: string) {
  return async (event: QueuedEvent<unknown>) => {
    console.log(`[event] ${topic}`, JSON.stringify(event.payload))
    
    // Evaluate notification rules and enqueue notifications
    const result = await evaluateAndEnqueue(topic, event.id, event.payload as Record<string, unknown>)
    if (result.notificationsQueued > 0) {
      console.log(`[event] ${topic} -> queued ${result.notificationsQueued} notifications`)
    }
  }
}

export function registerShipmentEventHandlers() {
  registerEventHandler(ShipmentEventTopics.Created, createHandler(ShipmentEventTopics.Created))
  registerEventHandler(ShipmentEventTopics.Updated, createHandler(ShipmentEventTopics.Updated))
  registerEventHandler(ShipmentEventTopics.StatusChanged, createHandler(ShipmentEventTopics.StatusChanged))
  registerEventHandler(ShipmentEventTopics.Delivered, createHandler(ShipmentEventTopics.Delivered))
  registerEventHandler(ShipmentEventTopics.Exception, createHandler(ShipmentEventTopics.Exception))
}
