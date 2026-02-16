/**
 * Thread Discovery Service
 *
 * Discovers and links Front customer conversations to shipments.
 * Uses email lookup and confidence scoring to match threads.
 */

import type { CustomerThreadRepository } from '@/lib/domain/customer-thread'
import {
  ThreadMatchStatus,
  ConfidenceThresholds,
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
   */
  discoverThread(params: {
    shipmentId: number
    customerEmail: string | null
    orderNumber: string
  }): Promise<ThreadDiscoveryResult>

  /**
   * Search Front for conversation candidates.
   */
  searchConversations(
    email: string
  ): Promise<ConversationCandidate[]>

  /**
   * Score candidates and return ranked results.
   */
  scoreCandidates(
    candidates: ConversationCandidate[],
    customerEmail: string | null,
    orderNumber: string
  ): ScoringResult[]
}

interface Dependencies {
  repository: CustomerThreadRepository
  frontClient: {
    searchConversations(query: string): Promise<Array<{
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
    async discoverThread({ shipmentId, customerEmail, orderNumber }) {
      const audit = getAuditService()

      // Check if already linked
      const existing = await repository.getByShipmentId(shipmentId)
      if (existing) {
        return {
          shipmentId,
          status: 'already_linked' as const,
          threadLink: existing,
          candidatesFound: 0,
          topScore: existing.confidenceScore,
        }
      }

      // If no customer email, we can't search
      if (!customerEmail) {
        await audit.recordSkipped({
          entityType: AuditEntityTypes.Shipment,
          entityId: String(shipmentId),
          action: AuditActions.ThreadSearched,
          reason: 'No customer email available',
        })

        return {
          shipmentId,
          status: 'not_found' as const,
          candidatesFound: 0,
          topScore: null,
        }
      }

      // Search Front for conversations
      const candidates = await this.searchConversations(customerEmail)

      // Record search in audit
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.ThreadSearched,
        metadata: {
          email: customerEmail,
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
          metadata: { email: customerEmail },
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
      const scores = this.scoreCandidates(candidates, customerEmail, orderNumber)
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

    async searchConversations(email: string): Promise<ConversationCandidate[]> {
      try {
        const results = await frontClient.searchConversations(email)

        return results.map((conv) => ({
          conversationId: conv.id,
          subject: conv.subject,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
          participants: conv.recipients.map((r) => r.handle),
        }))
      } catch (error) {
        console.error('[ThreadDiscovery] Failed to search Front:', error)
        return []
      }
    },

    scoreCandidates(
      candidates: ConversationCandidate[],
      customerEmail: string | null,
      orderNumber: string
    ): ScoringResult[] {
      const scores = candidates.map((candidate) =>
        calculateConfidenceScore(candidate, customerEmail, orderNumber)
      )

      // Sort by score descending
      return scores.sort((a, b) => b.score - a.score)
    },
  }
}
