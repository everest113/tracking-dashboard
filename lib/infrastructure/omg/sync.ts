/**
 * OMG Orders Data Sync
 *
 * Syncs OMG purchase order data to local database for quick access
 * and to avoid polluting the shipment model with OMG-specific fields.
 */

import { PrismaClient } from '@prisma/client'
import {
  findPurchaseOrderByPoNumber,
  type OMGOrder,
  type OMGPurchaseOrder,
} from './client'

const prisma = new PrismaClient()

// OMG webapp base URL
const OMG_WEBAPP_BASE = 'https://stitchi.omgorders.app'

/**
 * Build OMG webapp URLs
 */
export function getOmgUrls(omgOrderUuid: string, omgPoUuid: string) {
  return {
    order: `${OMG_WEBAPP_BASE}/orders/${omgOrderUuid}`,
    purchaseOrder: `${OMG_WEBAPP_BASE}/orders/${omgOrderUuid}/purchase-orders/${omgPoUuid}`,
  }
}

/**
 * Extract recipient data from OMG PO
 * OMG POs may have shipTo or similar fields - we'll adapt as we learn the schema
 */
function extractRecipients(po: OMGPurchaseOrder): Array<{
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}> {
  // TODO: Inspect actual OMG PO structure for recipient/shipping data
  // For now return empty array - we'll populate this when we learn the schema
  return []
}

/**
 * Sync a single PO from OMG to our database
 * Links to shipment if one exists with matching PO number
 */
export async function syncPurchaseOrder(
  poNumber: string
): Promise<{
  success: boolean
  omgPoId?: number
  linked?: boolean
  error?: string
}> {
  try {
    // Find the PO in OMG
    const result = await findPurchaseOrderByPoNumber(poNumber)
    if (!result) {
      return { success: false, error: 'PO not found in OMG' }
    }

    const { po, order } = result

    // Find matching shipment by PO number (if any)
    const shipment = await prisma.shipments.findFirst({
      where: { po_number: poNumber },
    })

    // Upsert the OMG purchase order record
    const omgPo = await prisma.omg_purchase_orders.upsert({
      where: { omg_po_uuid: po._id },
      create: {
        shipment_id: shipment?.id ?? null,
        po_number: po.poNumber,
        order_number: order.number, // Human-readable order number (e.g., "164")
        omg_order_uuid: order._id, // MongoDB ObjectID for URLs
        omg_po_uuid: po._id, // MongoDB ObjectID for URLs
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        recipients: extractRecipients(po),
        synced_at: new Date(),
        raw_data: JSON.parse(JSON.stringify({ po, order })),
      },
      update: {
        shipment_id: shipment?.id ?? null,
        po_number: po.poNumber,
        order_number: order.number,
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        recipients: extractRecipients(po),
        synced_at: new Date(),
        raw_data: JSON.parse(JSON.stringify({ po, order })),
      },
    })

    console.log(
      `[OMG Sync] Synced PO ${poNumber} (OMG ID: ${po._id})${
        shipment ? ` → linked to shipment ${shipment.id}` : ''
      }`
    )

    return {
      success: true,
      omgPoId: omgPo.id,
      linked: !!shipment,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[OMG Sync] Failed to sync PO ${poNumber}:`, errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Sync OMG data for a shipment
 * Fetches PO from OMG and links it to the shipment
 */
export async function syncShipmentOmgData(
  shipmentId: number
): Promise<{
  success: boolean
  omgPoId?: number
  error?: string
}> {
  // Get shipment with its PO number
  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
    select: { id: true, po_number: true },
  })

  if (!shipment) {
    return { success: false, error: 'Shipment not found' }
  }

  if (!shipment.po_number) {
    return { success: false, error: 'Shipment has no PO number' }
  }

  const result = await syncPurchaseOrder(shipment.po_number)

  // If successful, ensure the link is set
  if (result.success && result.omgPoId) {
    await prisma.omg_purchase_orders.update({
      where: { id: result.omgPoId },
      data: { shipment_id: shipmentId },
    })
  }

  return result
}

/**
 * Get OMG data for a shipment (if synced)
 */
export async function getShipmentOmgData(shipmentId: number) {
  const omgPo = await prisma.omg_purchase_orders.findUnique({
    where: { shipment_id: shipmentId },
  })

  if (!omgPo) return null

  return {
    ...omgPo,
    urls: getOmgUrls(omgPo.omg_order_uuid, omgPo.omg_po_uuid),
  }
}

/**
 * Link an existing OMG PO record to a shipment
 * Used when we already have OMG data but the shipment was created later
 */
export async function linkOmgPoToShipment(
  poNumber: string,
  shipmentId: number
): Promise<boolean> {
  // Normalize PO number (strip leading zeros from sequence)
  const match = poNumber.match(/^(\d+)-(\d+)$/)
  if (!match) return false
  
  const normalizedPo = `${match[1]}-${parseInt(match[2], 10)}`

  const result = await prisma.omg_purchase_orders.updateMany({
    where: { po_number: normalizedPo },
    data: { shipment_id: shipmentId },
  })

  return result.count > 0
}

/**
 * Batch sync all unlinked shipments with OMG data
 * Useful for initial data population or periodic sync
 */
export async function batchSyncOmgData(options?: {
  limit?: number
  onProgress?: (current: number, total: number) => void
}): Promise<{
  synced: number
  failed: number
  errors: Array<{ poNumber: string; error: string }>
}> {
  const limit = options?.limit ?? 100

  // Find shipments with PO numbers that don't have OMG data linked
  const shipments = await prisma.shipments.findMany({
    where: {
      po_number: { not: null },
      omg_purchase_order: null,
    },
    select: { id: true, po_number: true },
    take: limit,
  })

  let synced = 0
  let failed = 0
  const errors: Array<{ poNumber: string; error: string }> = []

  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i]
    if (!shipment.po_number) continue

    options?.onProgress?.(i + 1, shipments.length)

    const result = await syncShipmentOmgData(shipment.id)
    
    if (result.success) {
      synced++
    } else {
      failed++
      errors.push({
        poNumber: shipment.po_number,
        error: result.error ?? 'Unknown error',
      })
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 100))
  }

  return { synced, failed, errors }
}
