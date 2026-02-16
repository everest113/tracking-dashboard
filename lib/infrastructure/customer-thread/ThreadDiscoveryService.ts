/**
 * Thread Discovery Service
 *
 * Discovers and links Front customer conversations to shipments.
 * Uses email lookup and confidence scoring to match threads.
 * Can also search by order name/number when no customer email is available.
 */

import type { CustomerThreadRepository } from '@/lib/domain/customer-thread'
import {
  ThreadMatchStatus,
  calculateConfidenceScore,
  getMatchStatus,
  type ThreadDiscoveryResult,
  type ConversationCandidate,
  type ScoringResult,
} from '@/lib/domain/customer-thread'
import { getAuditService } from '@/lib/infrastructure/audit'
import { AuditEntityTypes, AuditActions } from '@/lib/domain/audit'

export interface ThreadDiscoveryService {
  /**
   * Discover and link a customer thread for a shipment.
   * Idempotent - returns existing link if already matched.
   * Note: orderNumber is customer-facing, not the internal PO number.
   * Can search by email, or by orderName/orderNumber if no email available.
   */
  discoverThread(params: {
    shipmentId: number
    customerEmail: string | null
    orderNumber: string
    orderName?: string | null
  }): Promise<ThreadDiscoveryResult>

  /**
   * Search Front for conversation candidates by email.
   */
  searchConversationsByEmail(email: string): Promise<ConversationCandidate[]>

  /**
   * Search Front for conversation candidates by query (order name/number).
   */
  searchConversationsByQuery(query: string): Promise<ConversationCandidate[]>

  /**
   * Score candidates and return ranked results.
   */
  scoreCandidates(
    candidates: ConversationCandidate[],
    customerEmail: string | null,
    orderNumber: string,
    orderName?: string | null
  ): ScoringResult[]
}

interface Dependencies {
  repository: CustomerThreadRepository
  frontClient: {
    searchConversationsByEmail(email: string): Promise<Array<{
      id: string
      subject: string | null
      lastMessageAt: string | null
      recipients: Array<{ handle: string }>
    }>>
    searchConversationsByQuery(query: string): Promise<Array<{
      id: string
      subject: string | null
      lastMessageAt: string | null
      recipients: Array<{ handle: string }>
    }>>
  }
}

export function createThreadDiscoveryService(
  deps: Dependencies
): ThreadDiscoveryService {
  const { repository, frontClient } = deps

  return {
    async discoverThread({ shipmentId, customerEmail, orderNumber, orderName }) {
      const audit = getAuditService()

      // Check if already linked (but allow re-discovery for not_found items)
      const existing = await repository.getByShipmentId(shipmentId)
      if (existing) {
        // Only skip re-discovery for successfully linked records
        if (existing.matchStatus === 'auto_matched' || 
            existing.matchStatus === 'manually_linked') {
          return {
            shipmentId,
            status: 'already_linked' as const,
            threadLink: existing,
            candidatesFound: 0,
            topScore: existing.confidenceScore,
          }
        }
        // For not_found or pending_review, delete old record and re-discover
        await repository.delete(shipmentId)
      }

      // Determine search strategy
      let candidates: ConversationCandidate[] = []
      let searchMethod: 'email' | 'query' = 'email'
      let searchTerm: string = ''

      if (customerEmail) {
        // Primary: search by customer email
        searchMethod = 'email'
        searchTerm = customerEmail
        candidates = await this.searchConversationsByEmail(customerEmail)
      }
      
      // If no email OR email search returned nothing, try searching by order name/number
      if (candidates.length === 0 && (orderName || orderNumber)) {
        searchMethod = 'query'
        // Search by order name first (more specific), fall back to order number
        searchTerm = orderName || `Order ${orderNumber}`
        candidates = await this.searchConversationsByQuery(searchTerm)
        
        // If order name search failed, try just the order number
        if (candidates.length === 0 && orderName && orderNumber) {
          searchTerm = orderNumber
          candidates = await this.searchConversationsByQuery(orderNumber)
        }
      }

      // If we still have no way to search, return not_found
      if (!customerEmail && !orderName && !orderNumber) {
        await audit.recordSkipped({
          entityType: AuditEntityTypes.Shipment,
          entityId: String(shipmentId),
          action: AuditActions.ThreadSearched,
          reason: 'No customer email or order info available',
        })

        return {
          shipmentId,
          status: 'not_found' as const,
          candidatesFound: 0,
          topScore: null,
        }
      }

      // Record search in audit
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ThreadSearched,
        metadata: {
          searchMethod,
          searchTerm,
          email: customerEmail,
          orderNumber,
          orderName,
          candidatesFound: candidates.length,
        },
      })

      if (candidates.length === 0) {
        // Create not_found record
        const link = await repository.create({
          shipmentId,
          frontConversationId: '',
          confidenceScore: 0,
          matchStatus: ThreadMatchStatus.NotFound,
          emailMatched: false,
          orderInSubject: false,
          orderInBody: false,
          daysSinceLastMessage: null,
          matchedEmail: customerEmail,
          conversationSubject: null,
        })

        await audit.recordSuccess({
          entityType: AuditEntityTypes.Shipment,
          entityId: String(shipmentId),
          action: AuditActions.ThreadNoMatch,
          metadata: { searchMethod, searchTerm },
        })

        return {
          shipmentId,
          status: 'not_found' as const,
          threadLink: link,
          candidatesFound: 0,
          topScore: null,
        }
      }

      // Score candidates
      const scores = this.scoreCandidates(candidates, customerEmail, orderNumber, orderName)
      const topCandidate = scores[0]

      // Determine match status
      const matchStatus = getMatchStatus(topCandidate.score)

      // Create thread link
      const link = await repository.create({
        shipmentId,
        frontConversationId: topCandidate.conversationId,
        confidenceScore: topCandidate.score,
        matchStatus,
        emailMatched: topCandidate.breakdown.emailMatched,
        orderInSubject: topCandidate.breakdown.orderInSubject,
        orderInBody: topCandidate.breakdown.orderInBody,
        daysSinceLastMessage: topCandidate.breakdown.daysSinceLastMessage,
        matchedEmail: customerEmail,
        conversationSubject: candidates.find(c => c.conversationId === topCandidate.conversationId)?.subject ?? null,
      })

      // Record match in audit
      if (matchStatus === ThreadMatchStatus.AutoMatched) {
        await audit.recordSuccess({
          entityType: AuditEntityTypes.Shipment,
          entityId: String(shipmentId),
          action: AuditActions.ThreadAutoMatched,
          metadata: {
            conversationId: topCandidate.conversationId,
            score: topCandidate.score,
            breakdown: topCandidate.breakdown,
            searchMethod,
          },
        })
      }

      return {
        shipmentId,
        status: matchStatus === ThreadMatchStatus.AutoMatched
          ? 'linked' as const
          : matchStatus === ThreadMatchStatus.PendingReview
            ? 'pending_review' as const
            : 'not_found' as const,
        threadLink: link,
        candidatesFound: candidates.length,
        topScore: topCandidate.score,
      }
    },

    async searchConversationsByEmail(email: string): Promise<ConversationCandidate[]> {
      try {
        const results = await frontClient.searchConversationsByEmail(email)

        return results.map((conv) => ({
          conversationId: conv.id,
          subject: conv.subject,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
          participants: conv.recipients.map((r) => r.handle),
        }))
      } catch (error) {
        console.error('[ThreadDiscovery] Failed to search Front by email:', error)
        return []
      }
    },

    async searchConversationsByQuery(query: string): Promise<ConversationCandidate[]> {
      try {
        const results = await frontClient.searchConversationsByQuery(query)

        return results.map((conv) => ({
          conversationId: conv.id,
          subject: conv.subject,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
          participants: conv.recipients.map((r) => r.handle),
        }))
      } catch (error) {
        console.error('[ThreadDiscovery] Failed to search Front by query:', error)
        return []
      }
    },

    scoreCandidates(
      candidates: ConversationCandidate[],
      customerEmail: string | null,
      orderNumber: string,
      orderName?: string | null
    ): ScoringResult[] {
      const scores = candidates.map((candidate) =>
        calculateConfidenceScore(candidate, customerEmail, orderNumber, orderName)
      )

      // Sort by score descending
      return scores.sort((a, b) => b.score - a.score)
    },
  }
}
