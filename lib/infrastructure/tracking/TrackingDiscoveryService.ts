/**
 * Tracking Discovery Service
 * 
 * Discovers tracking numbers for orders by searching Front conversations
 * for specific PO numbers. This is a targeted approach - we only search
 * for POs that are missing shipment data.
 */

import type { PrismaClient } from '@prisma/client'
import { searchConversations, getConversationMessages } from '@/lib/infrastructure/sdks/front/client'

// Common carrier tracking number patterns
const TRACKING_PATTERNS = [
  // UPS: 1Z followed by 16 alphanumeric chars
  { carrier: 'ups', pattern: /\b1Z[A-Z0-9]{16}\b/gi },
  // FedEx: 12, 15, 20, or 22 digits
  { carrier: 'fedex', pattern: /\b\d{12,22}\b/g },
  // USPS: 20-22 digits or specific formats
  { carrier: 'usps', pattern: /\b(94|93|92|91|94\d)\d{18,22}\b/g },
  // DHL: 10-11 digits
  { carrier: 'dhl', pattern: /\b\d{10,11}\b/g },
]

// Filter out false positives (phone numbers, zip codes, etc.)
function isLikelyTrackingNumber(num: string): boolean {
  // Too short
  if (num.length < 10) return false
  // UPS format is very reliable
  if (num.startsWith('1Z') && num.length === 18) return true
  // FedEx/USPS long numbers
  if (num.length >= 12 && num.length <= 22 && /^\d+$/.test(num)) return true
  return false
}

interface ExtractedTracking {
  trackingNumber: string
  carrier: string
  conversationId: string
  subject: string | null
}

interface DiscoveryResult {
  ordersProcessed: number
  posSearched: number
  trackingFound: number
  shipmentsCreated: number
  errors: Array<{ poNumber: string; error: string }>
}

export interface TrackingDiscoveryService {
  /**
   * Discover tracking for all orders with POs missing shipments
   */
  discoverAll(options?: { limit?: number }): Promise<DiscoveryResult>
  
  /**
   * Discover tracking for a specific order
   */
  discoverForOrder(orderNumber: string): Promise<{
    posSearched: number
    trackingFound: number
    shipmentsCreated: number
  }>
  
  /**
   * Discover tracking for a specific PO
   */
  discoverForPO(poNumber: string): Promise<ExtractedTracking[]>
}

export function createTrackingDiscoveryService(prisma: PrismaClient): TrackingDiscoveryService {
  const { normalizePoNumber } = require('@/lib/infrastructure/omg/sync')

  /**
   * Extract tracking numbers from conversation messages
   */
  async function extractTrackingFromConversation(conversationId: string): Promise<Array<{ trackingNumber: string; carrier: string }>> {
    const results: Array<{ trackingNumber: string; carrier: string }> = []
    const seen = new Set<string>()
    
    try {
      const messages = await getConversationMessages(conversationId)
      
      for (const message of messages) {
        const text = [message.subject, message.body, message.text].filter(Boolean).join(' ')
        
        for (const { carrier, pattern } of TRACKING_PATTERNS) {
          const matches = text.match(pattern) || []
          for (const match of matches) {
            const normalized = match.toUpperCase()
            if (!seen.has(normalized) && isLikelyTrackingNumber(normalized)) {
              seen.add(normalized)
              results.push({ trackingNumber: normalized, carrier })
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Tracking Discovery] Failed to get messages for ${conversationId}:`, err)
    }
    
    return results
  }

  /**
   * Search Front for a PO number and extract tracking
   */
  async function searchFrontForPO(poNumber: string): Promise<ExtractedTracking[]> {
    const results: ExtractedTracking[] = []
    
    // Try both formats: "164-1" and "164-01"
    const normalizedPo = normalizePoNumber(poNumber)
    const searchTerms = [poNumber]
    if (normalizedPo !== poNumber) {
      searchTerms.push(normalizedPo)
    }
    // Also try with leading zero
    const parts = normalizedPo.match(/^(\d+)-(\d+)$/)
    if (parts) {
      const withZero = `${parts[1]}-${parts[2].padStart(2, '0')}`
      if (!searchTerms.includes(withZero)) {
        searchTerms.push(withZero)
      }
    }
    
    const seenConversations = new Set<string>()
    
    for (const term of searchTerms) {
      try {
        // Search Front for this PO
        const conversations = await searchConversations(`"${term}"`, { limit: 20 })
        
        for (const conv of conversations) {
          if (seenConversations.has(conv.id)) continue
          seenConversations.add(conv.id)
          
          // Extract tracking from this conversation
          const tracking = await extractTrackingFromConversation(conv.id)
          
          for (const t of tracking) {
            results.push({
              trackingNumber: t.trackingNumber,
              carrier: t.carrier,
              conversationId: conv.id,
              subject: conv.subject || null,
            })
          }
        }
      } catch (err) {
        console.warn(`[Tracking Discovery] Failed to search for "${term}":`, err)
      }
    }
    
    return results
  }

  /**
   * Create shipment if it doesn't exist
   */
  async function createShipmentIfNew(
    trackingNumber: string,
    carrier: string,
    poNumber: string,
    conversationId: string
  ): Promise<boolean> {
    // Check if shipment already exists
    const existing = await prisma.shipments.findUnique({
      where: { tracking_number: trackingNumber },
    })
    
    if (existing) {
      // Update PO number if missing
      if (!existing.po_number && poNumber) {
        await prisma.shipments.update({
          where: { id: existing.id },
          data: { po_number: normalizePoNumber(poNumber) },
        })
        console.log(`[Tracking Discovery] Updated PO for existing shipment ${trackingNumber}`)
      }
      return false
    }
    
    // Create new shipment
    await prisma.shipments.create({
      data: {
        tracking_number: trackingNumber,
        carrier: carrier,
        po_number: normalizePoNumber(poNumber),
        front_conversation_id: conversationId,
        status: 'pending',
        updated_at: new Date(),
      },
    })
    
    console.log(`[Tracking Discovery] Created shipment ${trackingNumber} for PO ${poNumber}`)
    return true
  }

  return {
    async discoverAll(options = {}): Promise<DiscoveryResult> {
      const { limit = 50 } = options
      
      const result: DiscoveryResult = {
        ordersProcessed: 0,
        posSearched: 0,
        trackingFound: 0,
        shipmentsCreated: 0,
        errors: [],
      }
      
      // Get orders that might need tracking discovery
      // We'll check each PO to see if it has shipments
      const orders = await prisma.orders.findMany({
        orderBy: { order_number: 'desc' },
        take: limit,
        select: { order_number: true },
      })
      
      for (const order of orders) {
        result.ordersProcessed++
        
        // Get POs for this order
        const pos = await prisma.purchase_orders.findMany({
          where: { order_number: order.order_number },
          select: { po_number: true },
        })
        
        for (const po of pos) {
          // Check if this PO has any shipments
          const shipmentCount = await prisma.shipments.findMany({
            where: { po_number: { not: null } },
            select: { po_number: true },
          }).then(shipments => 
            shipments.filter(s => normalizePoNumber(s.po_number!) === po.po_number).length
          )
          
          if (shipmentCount === 0) {
            // No shipments for this PO - search Front
            result.posSearched++
            
            try {
              const tracking = await searchFrontForPO(po.po_number)
              result.trackingFound += tracking.length
              
              for (const t of tracking) {
                const created = await createShipmentIfNew(
                  t.trackingNumber,
                  t.carrier,
                  po.po_number,
                  t.conversationId
                )
                if (created) {
                  result.shipmentsCreated++
                }
              }
            } catch (err) {
              result.errors.push({
                poNumber: po.po_number,
                error: err instanceof Error ? err.message : 'Unknown error',
              })
            }
          }
        }
      }
      
      // Recompute order stats after discovery
      if (result.shipmentsCreated > 0) {
        const { createOrderSyncService } = await import('@/lib/infrastructure/order/OrderSyncService')
        const syncService = createOrderSyncService(prisma)
        await syncService.syncAll()
      }
      
      console.log(`[Tracking Discovery] Complete:`, result)
      return result
    },

    async discoverForOrder(orderNumber: string): Promise<{
      posSearched: number
      trackingFound: number
      shipmentsCreated: number
    }> {
      const result = {
        posSearched: 0,
        trackingFound: 0,
        shipmentsCreated: 0,
      }
      
      // Get POs for this order
      const pos = await prisma.purchase_orders.findMany({
        where: { order_number: orderNumber },
        select: { po_number: true },
      })
      
      for (const po of pos) {
        result.posSearched++
        
        const tracking = await searchFrontForPO(po.po_number)
        result.trackingFound += tracking.length
        
        for (const t of tracking) {
          const created = await createShipmentIfNew(
            t.trackingNumber,
            t.carrier,
            po.po_number,
            t.conversationId
          )
          if (created) {
            result.shipmentsCreated++
          }
        }
      }
      
      // Recompute stats for this order
      if (result.shipmentsCreated > 0) {
        const { createOrderSyncService } = await import('@/lib/infrastructure/order/OrderSyncService')
        const syncService = createOrderSyncService(prisma)
        await syncService.syncOrder(orderNumber)
      }
      
      return result
    },

    async discoverForPO(poNumber: string): Promise<ExtractedTracking[]> {
      return searchFrontForPO(poNumber)
    },
  }
}

// Singleton
let instance: TrackingDiscoveryService | null = null

export function getTrackingDiscoveryService(prisma: PrismaClient): TrackingDiscoveryService {
  if (!instance) {
    instance = createTrackingDiscoveryService(prisma)
  }
  return instance
}
