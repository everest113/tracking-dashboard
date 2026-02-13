import type { Shipment } from '@/lib/domain/entities/Shipment'
import { ShipmentStatus as SS } from '@/lib/domain/value-objects/ShipmentStatus'
import { TrackingNumber as TN } from '@/lib/domain/value-objects/TrackingNumber'
import type { EventMessage } from '../types'
import { ShipmentEventTopics } from './topics'

type ShipmentSnapshot = {
  shipmentId: number
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  supplier: string | null
  shippedDate: string | null
  deliveredDate: string | null
  estimatedDelivery: string | null
  lastChecked: string | null
}

export type ShipmentEventPayload = {
  current: ShipmentSnapshot
  previous?: ShipmentSnapshot
}

const toSnapshot = (shipment: Shipment): ShipmentSnapshot => ({
  shipmentId: shipment.id,
  trackingNumber: TN.toString(shipment.trackingNumber),
  status: SS.toString(shipment.status),
  carrier: shipment.carrier ?? null,
  poNumber: shipment.poNumber ?? null,
  supplier: shipment.supplier ?? null,
  shippedDate: shipment.shippedDate?.toISOString() ?? null,
  deliveredDate: shipment.deliveredDate?.toISOString() ?? null,
  estimatedDelivery: shipment.estimatedDelivery?.toISOString() ?? null,
  lastChecked: shipment.lastChecked?.toISOString() ?? null,
})

export function buildShipmentEvents(previous: Shipment | null, current: Shipment): EventMessage<ShipmentEventPayload>[] {
  const events: EventMessage<ShipmentEventPayload>[] = []
  const currentSnapshot = toSnapshot(current)

  if (!previous) {
    events.push({ topic: ShipmentEventTopics.Created, payload: { current: currentSnapshot } })
  }

  const previousSnapshot = previous ? toSnapshot(previous) : undefined

  // Always emit an update event so downstream systems can sync metadata
  events.push({
    topic: ShipmentEventTopics.Updated,
    payload: {
      current: currentSnapshot,
      previous: previousSnapshot,
    },
  })

  const previousStatus = previous ? SS.toString(previous.status) : null
  const currentStatus = currentSnapshot.status

  if (previousStatus !== currentStatus) {
    events.push({
      topic: ShipmentEventTopics.StatusChanged,
      payload: {
        current: currentSnapshot,
        previous: previousSnapshot,
      },
    })
  }

  if (previousStatus !== 'delivered' && currentStatus === 'delivered') {
    events.push({
      topic: ShipmentEventTopics.Delivered,
      payload: {
        current: currentSnapshot,
        previous: previousSnapshot,
      },
    })
  }

  if (currentStatus === 'exception' && previousStatus !== 'exception') {
    events.push({
      topic: ShipmentEventTopics.Exception,
      payload: {
        current: currentSnapshot,
        previous: previousSnapshot,
      },
    })
  }

  return events
}
