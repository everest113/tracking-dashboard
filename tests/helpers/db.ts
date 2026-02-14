/**
 * Database test helpers
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Create a shipment in the database for testing
 */
export async function createTestShipment(
  data: Partial<Prisma.shipmentsCreateInput> = {}
): Promise<Prisma.shipmentsGetPayload<Record<string, never>>> {
  return prisma.shipments.create({
    data: {
      tracking_number: data.tracking_number || `TEST${Date.now()}`,
      carrier: data.carrier || 'ups',
      status: data.status || 'pending',
      po_number: data.po_number || null,
      supplier: data.supplier || null,
      ship24_tracker_id: data.ship24_tracker_id || null,
      origin: data.origin || null,
      destination: data.destination || null,
      shipped_date: data.shipped_date || null,
      estimated_delivery: data.estimated_delivery || null,
      delivered_date: data.delivered_date || null,
      last_checked: data.last_checked || null,
      front_conversation_id: data.front_conversation_id || null,
      updated_at: new Date(),
    },
  })
}

/**
 * Create multiple test shipments
 */
export async function createTestShipments(
  count: number,
  baseData: Partial<Prisma.shipmentsCreateInput> = {}
): Promise<Prisma.shipmentsGetPayload<Record<string, never>>[]> {
  const shipments = []
  for (let i = 0; i < count; i++) {
    const shipment = await createTestShipment({
      ...baseData,
      tracking_number: `TEST${Date.now()}_${i}`,
    })
    shipments.push(shipment)
  }
  return shipments
}

/**
 * Create a tracking event for a shipment
 */
export async function createTestTrackingEvent(
  shipmentId: number,
  data: Partial<Prisma.tracking_eventsCreateInput> = {}
): Promise<Prisma.tracking_eventsGetPayload<Record<string, never>>> {
  return prisma.tracking_events.create({
    data: {
      shipment_id: shipmentId,
      status: data.status || 'in_transit',
      location: data.location || 'Test City, USA',
      message: data.message || 'Package in transit',
      event_time: data.event_time || new Date(),
    },
  })
}

/**
 * Get all shipments (for assertions)
 */
export async function getAllShipments() {
  return prisma.shipments.findMany({
    orderBy: { created_at: 'desc' },
  })
}

/**
 * Get shipment by tracking number
 */
export async function getShipmentByTracking(trackingNumber: string) {
  return prisma.shipments.findUnique({
    where: { tracking_number: trackingNumber },
    include: { tracking_events: true },
  })
}

/**
 * Clean all data (useful for specific test cleanup)
 */
export async function cleanDatabase() {
  await prisma.tracking_events.deleteMany()
  await prisma.omg_purchase_orders.deleteMany()
  await prisma.shipments.deleteMany()
  await prisma.scanned_conversations.deleteMany()
  await prisma.sync_history.deleteMany()
}
