export const ShipmentEventTopics = {
  Created: 'shipment.created',
  Updated: 'shipment.updated',
  StatusChanged: 'shipment.status.changed',
  Delivered: 'shipment.delivered',
  Exception: 'shipment.exception',
} as const

type Values<T> = T[keyof T]
export type ShipmentEventTopic = Values<typeof ShipmentEventTopics>
