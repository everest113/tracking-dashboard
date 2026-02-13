import { registerEventHandler } from '@/lib/application/events/registry'
import { ShipmentEventTopics } from './topics'

function logHandler(topic: string) {
  return async (event: { payload: unknown }) => {
    console.log(`[event] ${topic}`, JSON.stringify(event.payload))
  }
}

export function registerShipmentEventHandlers() {
  registerEventHandler(ShipmentEventTopics.Created, logHandler(ShipmentEventTopics.Created))
  registerEventHandler(ShipmentEventTopics.Updated, logHandler(ShipmentEventTopics.Updated))
  registerEventHandler(ShipmentEventTopics.StatusChanged, logHandler(ShipmentEventTopics.StatusChanged))
  registerEventHandler(ShipmentEventTopics.Delivered, logHandler(ShipmentEventTopics.Delivered))
  registerEventHandler(ShipmentEventTopics.Exception, logHandler(ShipmentEventTopics.Exception))
}
