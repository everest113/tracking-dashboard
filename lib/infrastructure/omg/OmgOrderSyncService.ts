/**
 * OMG Order Sync Service
 * 
 * Syncs orders directly from OMG API to our database.
 * This is the primary sync - orders exist independently of shipments.
 */

import type { PrismaClient } from '@prisma/client'
import { 
  listOrders,
  getOrder,
  getPurchaseOrders,
  type OMGOrder,
  type OMGOrderListItem,
  type OMGPurchaseOrder 
} from './client'

// Approval statuses to exclude from sync
const EXCLUDED_APPROVAL_STATUSES = [
  'pending_approval',
  'pending_prepayment', 
  'rejected',
]

export interface OmgOrderSyncResult {
  ordersCreated: number
  ordersUpdated: number
  ordersSkipped: number
  posCreated: number
  posUpdated: number
  totalOrdersProcessed: number
  errors: Array<{ orderNumber: string; error: string }>
}

export interface OmgOrderSyncOptions {
  /** Only sync orders updated after this date (default: 2 weeks ago) */
  since?: Date
  /** Force full resync (ignore since date) */
  fullResync?: boolean
  /** Trigger thread discovery for new orders */
  triggerThreadDiscovery?: boolean
}

export interface OmgOrderSyncService {
  /**
   * Sync all orders from OMG.
   * Filters out pending_approval and pending_prepayment orders.
   */
  syncAll(options?: OmgOrderSyncOptions): Promise<OmgOrderSyncResult>
  
  /**
   * Sync a single order by order number.
   */
  syncOrder(orderNumber: string): Promise<{ created: boolean; posCount: number } | null>
}

// Operations status priority (lower = earlier in workflow, takes precedence)
const OPERATIONS_STATUS_PRIORITY: Record<string, number> = {
  'in production': 1,
  'ready to ship': 2,
  'shipped': 3,
  'delivered': 4,
  'completed': 5,
  'cancelled': 10,
}

/**
 * Compute the overall operations status for an order based on its POs.
 * Returns the "earliest" status in the workflow (most active).
 */
function computeOrderOperationsStatus(pos: OMGPurchaseOrder[]): string | null {
  const statuses = pos
    .map(po => po.status?.operations)
    .filter((s): s is string => !!s)
  
  if (statuses.length === 0) return null
  
  // Sort by priority (lowest = earliest in workflow)
  statuses.sort((a, b) => {
    const aPriority = OPERATIONS_STATUS_PRIORITY[a.toLowerCase()] ?? 99
    const bPriority = OPERATIONS_STATUS_PRIORITY[b.toLowerCase()] ?? 99
    return aPriority - bPriority
  })
  
  return statuses[0] // Return the earliest/most active status
}

export function createOmgOrderSyncService(prisma: PrismaClient): OmgOrderSyncService {
  
  /**
   * Check if an order should be synced based on approval status
   */
  function shouldSyncOrder(order: OMGOrderListItem): boolean {
    const approvalStatus = order.status?.approval?.value?.toLowerCase()
    if (!approvalStatus) return true // Sync if no status
    return !EXCLUDED_APPROVAL_STATUSES.includes(approvalStatus)
  }

  /**
   * Upsert an order and its POs
   */
  async function upsertOrderWithPOs(
    order: OMGOrder,
    pos: OMGPurchaseOrder[]
  ): Promise<{ orderCreated: boolean; posCreated: number; posUpdated: number }> {
    // Check if order exists
    const existingOrder = await prisma.orders.findUnique({
      where: { order_number: order.number },
    })
    
    const orderCreated = !existingOrder
    
    // Extract primary customer email
    const customerEmail = order.customer?.email?.[0] ?? null
    
    // Compute aggregated operations status from POs
    const operationsStatus = computeOrderOperationsStatus(pos)
    
    // Upsert the order
    await prisma.orders.upsert({
      where: { order_number: order.number },
      create: {
        order_number: order.number,
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        customer_email: customerEmail,
        omg_order_id: order._id,
        omg_approval_status: order.status?.approval?.value ?? null,
        omg_operations_status: operationsStatus,
        omg_created_at: order.createdAt ? new Date(order.createdAt) : null,
        in_hands_date: order.inHandsDate ? new Date(order.inHandsDate) : null,
        followup_date: order.followupDate ? new Date(order.followupDate) : null,
        po_count: pos.length,
        last_synced_at: new Date(),
      },
      update: {
        order_name: order.name,
        customer_name: order.customer?.name ?? null,
        customer_email: customerEmail,
        omg_order_id: order._id,
        omg_approval_status: order.status?.approval?.value ?? null,
        omg_operations_status: operationsStatus,
        in_hands_date: order.inHandsDate ? new Date(order.inHandsDate) : null,
        followup_date: order.followupDate ? new Date(order.followupDate) : null,
        po_count: pos.length,
        last_synced_at: new Date(),
      },
    })
    
    // Upsert each PO
    let posCreated = 0
    let posUpdated = 0
    
    for (const po of pos) {
      const existingPO = await prisma.purchase_orders.findUnique({
        where: { po_number: po.poNumber },
      })
      
      if (existingPO) {
        posUpdated++
      } else {
        posCreated++
      }
      
      // Extract tracking numbers from PO
      const trackingNumbers = (po.tracking || []).map(t => ({
        number: t.number,
        carrier: t.carrierId,
        status: t.status,
      }))
      
      await prisma.purchase_orders.upsert({
        where: { po_number: po.poNumber },
        create: {
          po_number: po.poNumber,
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
    }
    
    return { orderCreated, posCreated, posUpdated }
  }

  return {
    async syncAll(options: OmgOrderSyncOptions = {}): Promise<OmgOrderSyncResult> {
      const {
        since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Default: 2 weeks
        fullResync = false,
        triggerThreadDiscovery = true,
      } = options
      
      const result: OmgOrderSyncResult = {
        ordersCreated: 0,
        ordersUpdated: 0,
        ordersSkipped: 0,
        posCreated: 0,
        posUpdated: 0,
        totalOrdersProcessed: 0,
        errors: [],
      }
      
      console.log(`[OMG Sync] Starting order sync (since: ${fullResync ? 'all time' : since.toISOString()})`)
      
      // Fetch all orders from OMG (paginated)
      let offset = 0
      const limit = 50
      let hasMore = true
      const newOrderNumbers: string[] = []
      
      while (hasMore) {
        try {
          const { orders, total } = await listOrders(offset, limit)
          
          for (const order of orders) {
            result.totalOrdersProcessed++
            
            // Filter by date if not full resync
            if (!fullResync && order.updatedAt) {
              const updatedAt = new Date(order.updatedAt)
              if (updatedAt < since) {
                continue // Skip older orders
              }
            }
            
            // Filter by approval status
            if (!shouldSyncOrder(order)) {
              result.ordersSkipped++
              console.log(`[OMG Sync] Skipping order ${order.number} (status: ${order.status?.approval?.value})`)
              continue
            }
            
            try {
              // Fetch full order details (includes inHandsDate, followupDate)
              const fullOrder = await getOrder(order._id)
              
              // Fetch POs for this order
              const pos = await getPurchaseOrders(order._id)
              
              // Upsert order and POs
              const upsertResult = await upsertOrderWithPOs(fullOrder, pos)
              
              if (upsertResult.orderCreated) {
                result.ordersCreated++
                newOrderNumbers.push(order.number)
              } else {
                result.ordersUpdated++
              }
              result.posCreated += upsertResult.posCreated
              result.posUpdated += upsertResult.posUpdated
              
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Unknown error'
              result.errors.push({ orderNumber: order.number, error: errorMsg })
              console.error(`[OMG Sync] Error syncing order ${order.number}:`, errorMsg)
            }
          }
          
          offset += limit
          hasMore = offset < total
          
          // Log progress
          console.log(`[OMG Sync] Progress: ${offset}/${total} orders processed`)
          
        } catch (err) {
          console.error('[OMG Sync] Failed to fetch orders:', err)
          break
        }
      }
      
      // Trigger thread discovery for new orders
      if (triggerThreadDiscovery && newOrderNumbers.length > 0) {
        console.log(`[OMG Sync] Triggering thread discovery for ${newOrderNumbers.length} new orders`)
        
        // Import dynamically to avoid circular deps
        const { getOrderThreadDiscoveryService } = await import('@/lib/infrastructure/customer-thread')
        const discoveryService = await getOrderThreadDiscoveryService()
        
        for (const orderNumber of newOrderNumbers) {
          try {
            const order = await prisma.orders.findUnique({
              where: { order_number: orderNumber },
              select: { order_number: true, customer_email: true, order_name: true },
            })
            
            if (order?.customer_email) {
              await discoveryService.discoverThread({
                orderNumber: order.order_number,
                customerEmail: order.customer_email,
                orderName: order.order_name,
              })
            }
          } catch (err) {
            console.warn(`[OMG Sync] Thread discovery failed for ${orderNumber}:`, err)
          }
        }
      }
      
      console.log(`[OMG Sync] Complete:`, {
        ordersCreated: result.ordersCreated,
        ordersUpdated: result.ordersUpdated,
        ordersSkipped: result.ordersSkipped,
        posCreated: result.posCreated,
        posUpdated: result.posUpdated,
        errors: result.errors.length,
      })
      
      return result
    },
    
    async syncOrder(orderNumber: string): Promise<{ created: boolean; posCount: number } | null> {
      // Find the order in OMG by iterating (no direct lookup API)
      let offset = 0
      const limit = 50
      let hasMore = true
      
      while (hasMore) {
        const { orders, total } = await listOrders(offset, limit)
        
        for (const order of orders) {
          if (order.number === orderNumber) {
            if (!shouldSyncOrder(order)) {
              console.log(`[OMG Sync] Order ${orderNumber} has excluded status: ${order.status?.approval?.value}`)
              return null
            }
            
            // Fetch full order details (includes inHandsDate, followupDate)
            const fullOrder = await getOrder(order._id)
            const pos = await getPurchaseOrders(order._id)
            const result = await upsertOrderWithPOs(fullOrder, pos)
            
            return {
              created: result.orderCreated,
              posCount: pos.length,
            }
          }
        }
        
        offset += limit
        hasMore = offset < total
      }
      
      console.log(`[OMG Sync] Order ${orderNumber} not found in OMG`)
      return null
    },
  }
}

// Singleton
let instance: OmgOrderSyncService | null = null

export function getOmgOrderSyncService(prisma: PrismaClient): OmgOrderSyncService {
  if (!instance) {
    instance = createOmgOrderSyncService(prisma)
  }
  return instance
}
