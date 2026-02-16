/**
 * Domain types for Customer Thread Matching.
 *
 * Handles matching shipments to Front customer conversations
 * for automated tracking notifications.
 */

/**
 * Match status for customer threads.
 */
export const ThreadMatchStatus = {
  AutoMatched: 'auto_matched',
  PendingReview: 'pending_review',
  ManuallyLinked: 'manually_linked',
  Rejected: 'rejected',
  NotFound: 'not_found',
} as const

export type ThreadMatchStatusType = typeof ThreadMatchStatus[keyof typeof ThreadMatchStatus]

/**
 * Confidence thresholds for auto-matching.
 */
export const ConfidenceThresholds = {
  HIGH: 0.7,    // Auto-link
  MEDIUM: 0.3,  // Manual review
  // Below MEDIUM = not found / low confidence
} as const

/**
 * Scoring weights for confidence calculation.
 * Note: We match ORDER number (customer-facing), not PO number (supplier-facing)
 */
export const ScoringWeights = {
  EMAIL_MATCH: 0.4,
  ORDER_IN_SUBJECT: 0.4, // Order number or name in subject
  ORDER_IN_BODY: 0.2,
  RECENCY_BONUS_MAX: 0.1, // Bonus for recent conversations
  RECENCY_DAYS_THRESHOLD: 30, // Days within which recency bonus applies
} as const

/**
 * Input for scoring a conversation candidate.
 */
export interface ConversationCandidate {
  conversationId: string
  subject: string | null
  lastMessageAt: Date | null
  participants: string[] // Email addresses
}

/**
 * Scoring result for a conversation candidate.
 */
export interface ScoringResult {
  conversationId: string
  score: number
  breakdown: {
    emailMatched: boolean
    orderInSubject: boolean
    orderInBody: boolean
    daysSinceLastMessage: number | null
    recencyBonus: number
  }
}

/**
 * Input for creating a customer thread link.
 */
export interface CreateCustomerThreadInput {
  shipmentId: number
  frontConversationId: string
  confidenceScore: number
  matchStatus: ThreadMatchStatusType
  emailMatched: boolean
  orderInSubject: boolean
  orderInBody: boolean
  daysSinceLastMessage: number | null
  matchedEmail: string | null
  conversationSubject: string | null
}

/**
 * A customer thread link record.
 */
export interface CustomerThreadLink {
  id: number
  shipmentId: number
  frontConversationId: string
  confidenceScore: number
  matchStatus: ThreadMatchStatusType
  emailMatched: boolean
  orderInSubject: boolean
  orderInBody: boolean
  daysSinceLastMessage: number | null
  matchedEmail: string | null
  conversationSubject: string | null
  createdAt: Date
  updatedAt: Date
  reviewedAt: Date | null
  reviewedBy: string | null
}

/**
 * Discovery result for a shipment.
 */
export interface ThreadDiscoveryResult {
  shipmentId: number
  status: 'linked' | 'pending_review' | 'not_found' | 'already_linked'
  threadLink?: CustomerThreadLink
  candidatesFound: number
  topScore: number | null
}

/**
 * Manual review action.
 */
export interface ReviewAction {
  shipmentId: number
  action: 'approve' | 'reject' | 'link_different'
  newConversationId?: string // Only for 'link_different'
  reviewedBy: string
}

/**
 * Calculate confidence score for a conversation candidate.
 * Note: We match against the ORDER number and/or name (customer-facing), not PO number (supplier-facing).
 */
export function calculateConfidenceScore(
  candidate: ConversationCandidate,
  customerEmail: string | null,
  orderNumber: string,
  orderName?: string | null
): ScoringResult {
  let score = 0
  const breakdown = {
    emailMatched: false,
    orderInSubject: false,
    orderInBody: false, // We'll check this separately if we have body access
    daysSinceLastMessage: null as number | null,
    recencyBonus: 0,
  }

  // Email match (40%)
  if (customerEmail) {
    const emailLower = customerEmail.toLowerCase()
    const participantsLower = candidate.participants.map((p) => p.toLowerCase())
    if (participantsLower.includes(emailLower)) {
      breakdown.emailMatched = true
      score += ScoringWeights.EMAIL_MATCH
    }
  }

  // Order number or name in subject (40%)
  if (candidate.subject) {
    const subjectLower = candidate.subject.toLowerCase()
    
    // Check for order number in various formats
    if (orderNumber) {
      const orderLower = orderNumber.toLowerCase()
      if (
        subjectLower.includes(orderLower) ||
        subjectLower.includes(`order ${orderLower}`) ||
        subjectLower.includes(`order# ${orderLower}`) ||
        subjectLower.includes(`order#${orderLower}`) ||
        subjectLower.includes(`#${orderLower}`)
      ) {
        breakdown.orderInSubject = true
        score += ScoringWeights.ORDER_IN_SUBJECT
      }
    }
    
    // Also check for order name in subject (if not already matched by number)
    if (!breakdown.orderInSubject && orderName) {
      const nameLower = orderName.toLowerCase()
      // Check if the order name appears in subject (fuzzy match - at least 3 consecutive words)
      if (nameLower.length >= 3 && subjectLower.includes(nameLower)) {
        breakdown.orderInSubject = true
        score += ScoringWeights.ORDER_IN_SUBJECT
      }
    }
  }

  // Recency bonus (up to 10%)
  if (candidate.lastMessageAt) {
    const daysSince = Math.floor(
      (Date.now() - candidate.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    breakdown.daysSinceLastMessage = daysSince

    if (daysSince <= ScoringWeights.RECENCY_DAYS_THRESHOLD) {
      // Linear decay: full bonus at 0 days, no bonus at threshold
      const recencyFactor = 1 - daysSince / ScoringWeights.RECENCY_DAYS_THRESHOLD
      breakdown.recencyBonus = ScoringWeights.RECENCY_BONUS_MAX * recencyFactor
      score += breakdown.recencyBonus
    }
  }

  return {
    conversationId: candidate.conversationId,
    score: Math.min(score, 1), // Cap at 1.0
    breakdown,
  }
}

/**
 * Determine match status based on confidence score.
 */
export function getMatchStatus(score: number): ThreadMatchStatusType {
  if (score >= ConfidenceThresholds.HIGH) {
    return ThreadMatchStatus.AutoMatched
  } else if (score >= ConfidenceThresholds.MEDIUM) {
    return ThreadMatchStatus.PendingReview
  } else {
    return ThreadMatchStatus.NotFound
  }
}
