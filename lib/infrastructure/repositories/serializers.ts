/**
 * Database to API serializers
 * Converts snake_case database fields to camelCase API responses
 */

import type { shipments, tracking_events } from '@prisma/client'

export type ShipmentResponse = {
  id: number
  trackingNumber: string
  carrier: string | null
  poNumber: string | null
  supplier: string | null
  status: string
  deliveredAt: Date | null
  ship24TrackerId: string | null
  ship24TrackerStatus: string | null
  ship24LastUpdate: Date | null
  frontConversationId: string | null
  createdAt: Date
  updatedAt: Date
  trackingEvents?: TrackingEventResponse[]
}

export type TrackingEventResponse = {
  id: number
  shipmentId: number
  status: string
  location: string | null
  timestamp: Date
  description: string | null
  eventTime: Date
  rawData: unknown
}

export function serializeShipment(
  shipment: shipments & { tracking_events?: tracking_events[] }
): ShipmentResponse {
  return {
    id: shipment.id,
    trackingNumber: shipment.tracking_number,
    carrier: shipment.carrier,
    poNumber: shipment.po_number,
    supplier: shipment.supplier,
    status: shipment.status,
    deliveredAt: shipment.delivered_at,
    ship24TrackerId: shipment.ship24_tracker_id,
    ship24TrackerStatus: shipment.ship24_tracker_status,
    ship24LastUpdate: shipment.ship24_last_update,
    frontConversationId: shipment.front_conversation_id,
    createdAt: shipment.created_at,
    updatedAt: shipment.updated_at,
    trackingEvents: shipment.tracking_events?.map(serializeTrackingEvent),
  }
}

export function serializeTrackingEvent(event: tracking_events): TrackingEventResponse {
  return {
    id: event.id,
    shipmentId: event.shipment_id,
    status: event.status,
    location: event.location,
    timestamp: event.timestamp,
    description: event.description,
    eventTime: event.event_time,
    rawData: event.raw_data,
  }
}

export function serializeShipments(
  shipments: (shipments & { tracking_events?: tracking_events[] })[]
): ShipmentResponse[] {
  return shipments.map(serializeShipment)
}
