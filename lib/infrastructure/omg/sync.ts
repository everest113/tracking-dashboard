/**
 * OMG Orders Data Sync
 *
 * Syncs OMG purchase order data to local database.
 * Uses the new orders + purchase_orders tables.
 */

import { PrismaClient } from '@prisma/client'
import {
  findPurchaseOrderByPoNumber,
  type OMGPurchaseOrder,
} from './client'

const prisma = new PrismaClient()

/**
 * Normalize PO number to consistent format
 * Strips leading zeros from sequence: "102-01" → "102-1"
 * This matches OMG's internal format
 */
export function normalizePoNumber(poNumber: string): string {
  const match = poNumber.match(/^(\d+)-(\d+)$/)
  if (!match) return poNumber
  return `${match[1]}-${parseInt(match[2], 10)}`
}

// OMG webapp base URL
const OMG_WEBAPP_BASE = 'https://stitchi.omgorders.app'

/**
 * Build OMG webapp URLs
 */
export function getOmgUrls(omgOrderUuid: string, omgPoUuid: string) {
  return {
    order: `${OMG_WEBAPP_BASE}/orders/${omgOrderUuid}/order`,
    purchaseOrder: `${OMG_WEBAPP_BASE}/orders/${omgOrderUuid}/purchase-orders/${omgPoUuid}`,
  }
}

/**
 * Sync a single PO from OMG to our database.
 * Creates/updates both order and purchase_order records.
 */
export async function syncPurchaseOrder(
  poNumber: string
): Promise<{
  success: boolean
  poId?: number
  linked?: boolean
  error?: string
}> {
  try {
    const normalizedPo = normalizePoNumber(poNumber)
    
    // Find the PO in OMG
    const result = await findPurchaseOrderByPoNumber(normalizedPo)
    if (!result) {
      return { success: false, error: 'PO not found in OMG' }
    }

    const { po, order } = result
    const customerEmail = order.customer?.email?.[0] ?? null

    // Upsert the order first
    await prisma.orders.upsert({
      where: { order_number: order.number },
      create: {
        order_number: order.number,
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        customer_email: customerEmail,
        omg_order_id: order._id,
        omg_approval_status: order.status?.approval?.value ?? null,
        omg_created_at: order.createdAt ? new Date(order.createdAt) : null,
        po_count: 1,
        last_synced_at: new Date(),
      },
      update: {
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        customer_email: customerEmail,
        omg_approval_status: order.status?.approval?.value ?? null,
        last_synced_at: new Date(),
      },
    })

    // Extract tracking numbers
    const trackingNumbers = (po.tracking || []).map(t => ({
      number: t.number,
      carrier: t.carrierId,
      status: t.status,
    }))

    // Upsert the purchase order
    const poRecord = await prisma.purchase_orders.upsert({
      where: { po_number: normalizedPo },
      create: {
        po_number: normalizedPo,
        order_number: order.number,
        omg_po_id: po._id,
        omg_order_id: order._id,
        supplier_name: po.supplier?.name ?? null,
        ship_date: po.shipDate ? new Date(po.shipDate) : null,
        in_hands_date: po.inHandsDate ? new Date(po.inHandsDate) : null,
        operations_status: po.status?.operations ?? null,
        tracking_numbers: trackingNumbers,
        synced_at: new Date(),
      },
      update: {
        order_number: order.number,
        omg_order_id: order._id,
        supplier_name: po.supplier?.name ?? null,
        ship_date: po.shipDate ? new Date(po.shipDate) : null,
        in_hands_date: po.inHandsDate ? new Date(po.inHandsDate) : null,
        operations_status: po.status?.operations ?? null,
        tracking_numbers: trackingNumbers,
        synced_at: new Date(),
      },
    })

    // Update po_count on order
    const poCount = await prisma.purchase_orders.count({
      where: { order_number: order.number },
    })
    await prisma.orders.update({
      where: { order_number: order.number },
      data: { po_count: poCount },
    })

    console.log(`[OMG Sync] Synced PO ${poNumber} → order ${order.number}`)

    return {
      success: true,
      poId: poRecord.id,
      linked: true,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[OMG Sync] Failed to sync PO ${poNumber}:`, errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Sync OMG data for a shipment by its PO number
 */
export async function syncShipmentOmgData(
  shipmentId: number
): Promise<{
  success: boolean
  poId?: number
  error?: string
}> {
  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
    select: { po_number: true },
  })

  if (!shipment?.po_number) {
    return { success: false, error: 'Shipment has no PO number' }
  }

  return syncPurchaseOrder(shipment.po_number)
}

/**
 * Get OMG data for a shipment via its PO number
 */
export async function getShipmentOmgData(shipmentId: number): Promise<{
  orderNumber: string
  orderName: string | null
  customerName: string | null
  orderUrl: string
  poUrl: string
} | null> {
  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
    select: { po_number: true },
  })

  if (!shipment?.po_number) return null

  const normalizedPo = normalizePoNumber(shipment.po_number)
  const poRecord = await prisma.purchase_orders.findUnique({
    where: { po_number: normalizedPo },
    include: { order: true },
  })

  if (!poRecord) return null

  const urls = getOmgUrls(poRecord.omg_order_id, poRecord.omg_po_id)
  return {
    orderNumber: poRecord.order_number,
    orderName: poRecord.order?.order_name ?? null,
    customerName: poRecord.order?.customer_name ?? null,
    orderUrl: urls.order,
    poUrl: urls.purchaseOrder,
  }
}

/**
 * Link an existing PO to a shipment (manual operation)
 */
export async function linkOmgPoToShipment(
  shipmentId: number,
  poNumber: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedPo = normalizePoNumber(poNumber)
  
  // Check if PO exists
  const poRecord = await prisma.purchase_orders.findUnique({
    where: { po_number: normalizedPo },
  })
  
  if (!poRecord) {
    // Try to sync it from OMG
    const syncResult = await syncPurchaseOrder(poNumber)
    if (!syncResult.success) {
      return { success: false, error: syncResult.error }
    }
  }
  
  // Update shipment with PO number
  await prisma.shipments.update({
    where: { id: shipmentId },
    data: { po_number: normalizedPo },
  })
  
  return { success: true }
}

/**
 * Batch sync OMG data for shipments that have PO numbers
 */
export async function batchSyncOmgData(options: { limit?: number } = {}): Promise<{
  processed: number
  synced: number
  failed: number
  errors: Array<{ poNumber: string; error: string }>
}> {
  const { limit = 50 } = options
  
  // Find shipments with PO numbers that aren't yet linked to orders
  const shipments = await prisma.shipments.findMany({
    where: { 
      po_number: { not: null },
    },
    select: { id: true, po_number: true },
    take: limit,
  })
  
  // Get existing POs to skip
  const existingPOs = await prisma.purchase_orders.findMany({
    select: { po_number: true },
  })
  const existingSet = new Set(existingPOs.map(p => p.po_number))
  
  // Filter to unsynced
  const toSync = shipments.filter(s => {
    if (!s.po_number) return false
    const normalized = normalizePoNumber(s.po_number)
    return !existingSet.has(normalized)
  })
  
  let synced = 0
  let failed = 0
  const errors: Array<{ poNumber: string; error: string }> = []
  
  for (const shipment of toSync) {
    if (!shipment.po_number) continue
    
    const result = await syncPurchaseOrder(shipment.po_number)
    if (result.success) {
      synced++
    } else {
      failed++
      errors.push({ poNumber: shipment.po_number, error: result.error || 'Unknown error' })
    }
  }
  
  return {
    processed: toSync.length,
    synced,
    failed,
    errors,
  }
}
