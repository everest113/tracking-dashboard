/**
 * Database mappers
 * Convert between Prisma models (snake_case) and domain records (camelCase)
 */

import type { PrismaShipment } from './types'
import type { ShipmentRecord } from '@/lib/domain/entities/Shipment'

/**
 * Convert Prisma shipment (snake_case) to domain record (camelCase)
 */
export function prismaShipmentToRecord(prisma: PrismaShipment): ShipmentRecord {
  return {
    id: prisma.id,
    poNumber: prisma.po_number,
    trackingNumber: prisma.tracking_number,
    carrier: prisma.carrier,
    supplier: prisma.supplier,
    status: prisma.status,
    ship24TrackerId: prisma.ship24_tracker_id,
    shippedDate: prisma.shipped_date,
    estimatedDelivery: prisma.estimated_delivery,
    deliveredDate: prisma.delivered_date,
    lastChecked: prisma.last_checked,
    frontConversationId: prisma.front_conversation_id,
    createdAt: prisma.created_at,
    updatedAt: prisma.updated_at,
  }
}

/**
 * Convert domain record to Prisma format for persistence
 * Used in upsert operations
 */
export function recordToPrismaData(record: Omit<ShipmentRecord, 'createdAt'>): {
  po_number: string | null
  tracking_number: string
  carrier: string | null
  supplier: string | null
  status: string
  ship24_tracker_id: string | null
  shipped_date: Date | null
  estimated_delivery: Date | null
  delivered_date: Date | null
  last_checked: Date | null
  front_conversation_id: string | null
  updated_at: Date
} {
  return {
    po_number: record.poNumber,
    tracking_number: record.trackingNumber,
    carrier: record.carrier,
    supplier: record.supplier,
    status: record.status,
    ship24_tracker_id: record.ship24TrackerId,
    shipped_date: record.shippedDate,
    estimated_delivery: record.estimatedDelivery,
    delivered_date: record.deliveredDate,
    last_checked: record.lastChecked,
    front_conversation_id: record.frontConversationId,
    updated_at: record.updatedAt,
  }
}
