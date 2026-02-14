import { registerEventHandler } from '@/lib/application/events/registry'
import { getShipmentNotificationService } from '@/lib/application/notifications'
import type { TriggerOptions } from '@/lib/application/notifications/ports'
import type { ShipmentObjectData, ShipmentNotificationData } from '@/lib/application/notifications/types'
import { ShipmentEventTopics } from './topics'
import type { QueuedEvent } from '@/lib/application/events/types'
import type { ShipmentEventPayload } from './buildShipmentEvents'

/**
 * Build object data from shipment snapshot.
 */
function toObjectData(snapshot: ShipmentEventPayload['current']): ShipmentObjectData {
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
 * Build notification data from shipment snapshot.
 */
function toNotificationData(
  current: ShipmentEventPayload['current'],
  previous?: ShipmentEventPayload['previous']
): ShipmentNotificationData {
  return {
    trackingNumber: current.trackingNumber,
    status: current.status,
    carrier: current.carrier,
    poNumber: current.poNumber,
    previousStatus: previous?.status ?? null,
    estimatedDelivery: current.estimatedDelivery,
    deliveredDate: current.deliveredDate,
  }
}

/**
 * Build trigger options for a shipment event.
 */
function buildTriggerOptions(
  eventId: string,
  shipmentId: string
): TriggerOptions {
  return {
    idempotencyKey: `${eventId}:${shipmentId}`,
    cancellationKey: `shipment:${shipmentId}`,
    // TODO: Implement tenant/actor lookup
    // tenant: getTenantForShipment(poNumber),
    // actor: getActorForEvent(eventId),
  }
}

/**
 * Handler for shipment.created events.
 */
async function handleCreated(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  console.log(`[event] ${ShipmentEventTopics.Created}`, JSON.stringify(payload))

  if (!payload?.current) return

  const shipmentId = payload.current.shipmentId.toString()
  const service = getShipmentNotificationService()

  await service.syncShipment(shipmentId, toObjectData(payload.current))
  await service.notifyCreated(
    shipmentId,
    toNotificationData(payload.current),
    buildTriggerOptions(event.id, shipmentId)
  )
}

/**
 * Handler for shipment.status.changed events.
 */
async function handleStatusChanged(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  console.log(`[event] ${ShipmentEventTopics.StatusChanged}`, JSON.stringify(payload))

  if (!payload?.current) return

  const shipmentId = payload.current.shipmentId.toString()
  const service = getShipmentNotificationService()

  await service.syncShipment(shipmentId, toObjectData(payload.current))
  await service.notifyStatusChanged(
    shipmentId,
    toNotificationData(payload.current, payload.previous),
    buildTriggerOptions(event.id, shipmentId)
  )
}

/**
 * Handler for shipment.delivered events.
 */
async function handleDelivered(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  console.log(`[event] ${ShipmentEventTopics.Delivered}`, JSON.stringify(payload))

  if (!payload?.current) return

  const shipmentId = payload.current.shipmentId.toString()
  const service = getShipmentNotificationService()

  await service.syncShipment(shipmentId, toObjectData(payload.current))
  await service.notifyDelivered(
    shipmentId,
    toNotificationData(payload.current, payload.previous),
    buildTriggerOptions(event.id, shipmentId)
  )
}

/**
 * Handler for shipment.exception events.
 */
async function handleException(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  console.log(`[event] ${ShipmentEventTopics.Exception}`, JSON.stringify(payload))

  if (!payload?.current) return

  const shipmentId = payload.current.shipmentId.toString()
  const service = getShipmentNotificationService()

  await service.syncShipment(shipmentId, toObjectData(payload.current))
  await service.notifyException(
    shipmentId,
    toNotificationData(payload.current, payload.previous),
    buildTriggerOptions(event.id, shipmentId)
  )
}

/**
 * Handler for shipment.updated events.
 * Only syncs the object, doesn't trigger a workflow.
 */
async function handleUpdated(event: QueuedEvent<unknown>): Promise<void> {
  const payload = event.payload as ShipmentEventPayload
  console.log(`[event] ${ShipmentEventTopics.Updated}`, JSON.stringify(payload))

  if (!payload?.current) return

  const shipmentId = payload.current.shipmentId.toString()
  const service = getShipmentNotificationService()

  await service.syncShipment(shipmentId, toObjectData(payload.current))
}

export function registerShipmentEventHandlers() {
  registerEventHandler(ShipmentEventTopics.Created, handleCreated)
  registerEventHandler(ShipmentEventTopics.StatusChanged, handleStatusChanged)
  registerEventHandler(ShipmentEventTopics.Delivered, handleDelivered)
  registerEventHandler(ShipmentEventTopics.Exception, handleException)
  registerEventHandler(ShipmentEventTopics.Updated, handleUpdated)
}
