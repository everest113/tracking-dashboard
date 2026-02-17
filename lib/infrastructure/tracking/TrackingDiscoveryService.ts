/**
 * Tracking Discovery Service
 * 
 * Discovers tracking numbers for orders by searching Front conversations
 * for specific PO numbers. This is a targeted approach - we only search
 * for POs that are missing shipment data.
 */

import type { PrismaClient } from '@prisma/client'
import { searchConversations, getConversationMessages } from '@/lib/infrastructure/sdks/front/client'

// Maximum tracking numbers to extract per conversation (prevents SKU floods)
const MAX_TRACKING_PER_CONVERSATION = 20

// Common carrier tracking number patterns (conservative - prefer false negatives over false positives)
const TRACKING_PATTERNS = [
  // UPS: 1Z followed by 16 alphanumeric chars (very reliable format)
  { carrier: 'ups', pattern: /\b1Z[A-Z0-9]{16}\b/gi },
  // FedEx Express: 12 digits starting with certain prefixes (7, 4)
  // Most FedEx Express numbers start with 7 or 4
  { carrier: 'fedex', pattern: /\b[47]\d{11}\b/g },
  // FedEx Ground: 15 digits (home delivery often starts with 96)
  { carrier: 'fedex', pattern: /\b(96\d{13}|9\d{14})\b/g },
  // USPS: 20-22 digits starting with specific prefixes
  { carrier: 'usps', pattern: /\b(94|93|92|91)\d{18,20}\b/g },
  // DHL: JJD waybill format only (10-11 digits too prone to false positives)
  { carrier: 'dhl', pattern: /\bJJD\d{10,}\b/gi },
]

// Filter out false positives
function isLikelyTrackingNumber(num: string): boolean {
  const cleaned = num.toUpperCase().replace(/[\s-]/g, '')
  
  // UPS format is very reliable
  if (cleaned.startsWith('1Z') && cleaned.length === 18) return true
  
  // USPS: 20-22 digits starting with 9
  if (/^9[0-9]{19,21}$/.test(cleaned)) return true
  
  // FedEx Express: 12 digits starting with 7 or 4
  if (/^[47]\d{11}$/.test(cleaned)) return true
  
  // FedEx Ground: 15 digits starting with 9
  if (/^9\d{14}$/.test(cleaned)) return true
  
  // DHL JJD format
  if (/^JJD\d{10,}$/i.test(cleaned)) return true
  
  // Reject everything else
  return false
}

/**
 * Filter out sequential numbers that are likely SKUs/item codes
 * If many numbers differ by small constants (64, 128, etc.), they're probably not tracking numbers
 */
function filterSequentialNumbers(tracking: Array<{ trackingNumber: string; carrier: string }>): Array<{ trackingNumber: string; carrier: string }> {
  if (tracking.length <= 3) return tracking
  
  // Sort numeric-only tracking numbers
  const numericTracking = tracking.filter(t => /^\d+$/.test(t.trackingNumber))
  if (numericTracking.length <= 3) return tracking
  
  // Check for sequential patterns (common SKU increments: 1, 64, 128, 256, 1000)
  const nums = numericTracking.map(t => ({ ...t, value: BigInt(t.trackingNumber) }))
    .sort((a, b) => a.value < b.value ? -1 : 1)
  
  let sequentialCount = 0
  const suspiciousDiffs = [BigInt(1), BigInt(64), BigInt(128), BigInt(256), BigInt(512), BigInt(1000), BigInt(10000)]
  
  for (let i = 0; i < nums.length - 1; i++) {
    const diff = nums[i + 1].value - nums[i].value
    if (suspiciousDiffs.includes(diff)) {
      sequentialCount++
    }
  }
  
  // If more than 30% of numbers are sequential, it's likely SKU data - reject all numeric
  const sequentialRatio = sequentialCount / (nums.length - 1)
  if (sequentialRatio > 0.3) {
    console.warn(`[Tracking Discovery] Rejecting ${numericTracking.length} numbers due to sequential pattern (${(sequentialRatio * 100).toFixed(0)}% sequential)`)
    return tracking.filter(t => !/^\d+$/.test(t.trackingNumber)) // Keep only non-numeric (like UPS 1Z...)
  }
  
  return tracking
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
  // Helper to get normalizePoNumber (dynamic import to avoid require)
  const getNormalizePoNumber = async () => {
    const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
    return normalizePoNumber
  }

  /**
   * Extract tracking numbers from conversation messages
   */
  async function extractTrackingFromConversation(conversationId: string): Promise<Array<{ trackingNumber: string; carrier: string }>> {
    let results: Array<{ trackingNumber: string; carrier: string }> = []
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
      
      // Filter out sequential SKU-like numbers
      results = filterSequentialNumbers(results)
      
      // Limit results to prevent floods
      if (results.length > MAX_TRACKING_PER_CONVERSATION) {
        console.warn(`[Tracking Discovery] Limiting ${results.length} tracking numbers to ${MAX_TRACKING_PER_CONVERSATION} for conversation ${conversationId}`)
        results = results.slice(0, MAX_TRACKING_PER_CONVERSATION)
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
    const normalizePoNumber = await getNormalizePoNumber()
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
    const normalizePoNumber = await getNormalizePoNumber()
    
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
      const normalizePoNumber = await getNormalizePoNumber()
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
