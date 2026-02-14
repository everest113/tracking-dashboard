import { registerEventHandler } from '@/lib/application/events/registry'
import {
  triggerShipmentWorkflow,
  upsertShipmentObject,
  KnockWorkflows,
  type ShipmentObjectData,
  type TriggerOptions,
} from '@/lib/infrastructure/notifications/knock'
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

/**
 * Build Knock object data from shipment snapshot.
 */
function toShipmentObjectData(snapshot: ShipmentEventPayload['current']): ShipmentObjectData {
  return {
    trackingNumber: snapshot.trackingNumber,
    status: snapshot.status,
    carrier: snapshot.carrier,
    poNumber: snapshot.poNumber,
    supplier: snapshot.supplier,
    estimatedDelivery: snapshot.estimatedDelivery,
    deliveredDate: snapshot.deliveredDate,
    shippedDate: snapshot.shippedDate,
  }
}

/**
 * Get trigger options for a shipment event.
 * 
 * TODO: Implement tenant/actor lookup based on your data model:
 * - tenant: Could be the customer account ID from the order
 * - actor: Could be the CSM or system user who triggered the update
 */
function getTriggerOptions(
  eventId: string,
  payload: ShipmentEventPayload
): TriggerOptions {
  const shipmentId = payload.current.shipmentId.toString()
  
  return {
    // Idempotency key prevents duplicate notifications for the same event
    idempotencyKey: `${eventId}:${shipmentId}`,
    
    // Cancellation key allows canceling in-progress workflows
    cancellationKey: `shipment:${shipmentId}`,
    
    // TODO: Look up tenant from order/project data
    // tenant: getTenantForShipment(payload.current.poNumber),
    
    // TODO: Pass actor if this was triggered by a user action
    // actor: getActorForEvent(eventId),
  }
}

function createHandler(topic: string) {
  return async (event: QueuedEvent<ShipmentEventPayload>) => {
    const payload = event.payload
    console.log(`[event] ${topic}`, JSON.stringify(payload))

    if (!payload.current) {
      console.warn(`[event] ${topic} - missing current payload, skipping`)
      return
    }

    const shipmentId = payload.current.shipmentId.toString()

    // 1. Upsert shipment as a Knock Object (keeps Knock in sync)
    await upsertShipmentObject(shipmentId, toShipmentObjectData(payload.current))

    // 2. Trigger the appropriate workflow
    const knockWorkflow = topicToWorkflow[topic]
    if (knockWorkflow) {
      const options = getTriggerOptions(event.id, payload)

      await triggerShipmentWorkflow(
        knockWorkflow,
        shipmentId,
        {
          trackingNumber: payload.current.trackingNumber,
          status: payload.current.status,
          carrier: payload.current.carrier,
          poNumber: payload.current.poNumber,
          previousStatus: payload.previous?.status ?? null,
          estimatedDelivery: payload.current.estimatedDelivery,
          deliveredDate: payload.current.deliveredDate,
        },
        options
      )
    }
  }
}

/**
 * Handler for shipment.updated events.
 * Only syncs the object to Knock, doesn't trigger a workflow.
 */
function createUpdatedHandler() {
  return async (event: QueuedEvent<ShipmentEventPayload>) => {
    const payload = event.payload
    console.log(`[event] ${ShipmentEventTopics.Updated}`, JSON.stringify(payload))

    if (!payload.current) {
      return
    }

    const shipmentId = payload.current.shipmentId.toString()

    // Just sync the object - no workflow trigger for generic updates
    await upsertShipmentObject(shipmentId, toShipmentObjectData(payload.current))
  }
}

export function registerShipmentEventHandlers() {
  // Events that trigger workflows
  registerEventHandler(ShipmentEventTopics.Created, createHandler(ShipmentEventTopics.Created))
  registerEventHandler(ShipmentEventTopics.StatusChanged, createHandler(ShipmentEventTopics.StatusChanged))
  registerEventHandler(ShipmentEventTopics.Delivered, createHandler(ShipmentEventTopics.Delivered))
  registerEventHandler(ShipmentEventTopics.Exception, createHandler(ShipmentEventTopics.Exception))

  // Updated just syncs the object, no workflow
  registerEventHandler(ShipmentEventTopics.Updated, createUpdatedHandler())
}
