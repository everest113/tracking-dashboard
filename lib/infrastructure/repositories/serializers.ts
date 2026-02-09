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
  origin: string | null
  destination: string | null
  shippedDate: Date | null
  estimatedDelivery: Date | null
  deliveredDate: Date | null
  lastChecked: Date | null
  ship24TrackerId: string | null
  frontConversationId: string | null
  createdAt: Date
  updatedAt: Date
  trackingEvents?: TrackingEventResponse[]
}

export type TrackingEventResponse = {
  id: number
  shipmentId: number
  status: string | null
  location: string | null
  message: string | null
  eventTime: Date | null
  createdAt: Date
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
    origin: shipment.origin,
    destination: shipment.destination,
    shippedDate: shipment.shipped_date,
    estimatedDelivery: shipment.estimated_delivery,
    deliveredDate: shipment.delivered_date,
    lastChecked: shipment.last_checked,
    ship24TrackerId: shipment.ship24_tracker_id,
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
    message: event.message,
    eventTime: event.event_time,
    createdAt: event.created_at,
  }
}

export function serializeShipments(
  shipments: (shipments & { tracking_events?: tracking_events[] })[]
): ShipmentResponse[] {
  return shipments.map(serializeShipment)
}
