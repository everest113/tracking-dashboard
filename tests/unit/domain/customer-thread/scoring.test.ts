/**
 * Unit tests for Customer Thread Scoring Logic
 */

import { describe, it, expect } from 'vitest'
import {
  calculateConfidenceScore,
  getMatchStatus,
  ConfidenceThresholds,
  ThreadMatchStatus,
  ScoringWeights,
  type ConversationCandidate,
} from '@/lib/domain/customer-thread'

describe('calculateConfidenceScore', () => {
  const baseCandidate: ConversationCandidate = {
    conversationId: 'cnv_123',
    subject: 'Order Update',
    lastMessageAt: new Date(),
    participants: ['customer@example.com', 'support@company.com'],
  }

  describe('email matching', () => {
    it('should give 0.4 for exact email match', () => {
      const result = calculateConfidenceScore(
        baseCandidate,
        'customer@example.com',
        '164-1'
      )

      expect(result.breakdown.emailMatched).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(ScoringWeights.EMAIL_MATCH)
    })

    it('should match email case-insensitively', () => {
      const result = calculateConfidenceScore(
        baseCandidate,
        'CUSTOMER@EXAMPLE.COM',
        '164-1'
      )

      expect(result.breakdown.emailMatched).toBe(true)
    })

    it('should not match if email not in participants', () => {
      const result = calculateConfidenceScore(
        baseCandidate,
        'other@example.com',
        '164-1'
      )

      expect(result.breakdown.emailMatched).toBe(false)
    })

    it('should not match if no customer email provided', () => {
      const result = calculateConfidenceScore(
        baseCandidate,
        null,
        '164-1'
      )

      expect(result.breakdown.emailMatched).toBe(false)
    })
  })

  describe('PO number in subject', () => {
    it('should match exact PO number in subject', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        subject: 'Re: Order 164-1 - Shipping Update',
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.poInSubject).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(ScoringWeights.PO_IN_SUBJECT)
    })

    it('should match PO with prefix', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        subject: 'PO 164-1 Ready for Shipment',
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.poInSubject).toBe(true)
    })

    it('should match PO# prefix', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        subject: 'PO#164-1 Tracking',
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.poInSubject).toBe(true)
    })

    it('should not match if PO not in subject', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        subject: 'General Inquiry',
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.poInSubject).toBe(false)
    })

    it('should handle null subject', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        subject: null,
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.poInSubject).toBe(false)
    })
  })

  describe('recency bonus', () => {
    it('should give full bonus for conversation from today', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        lastMessageAt: new Date(),
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.recencyBonus).toBeCloseTo(
        ScoringWeights.RECENCY_BONUS_MAX,
        1
      )
    })

    it('should give partial bonus for recent conversation', () => {
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

      const candidate: ConversationCandidate = {
        ...baseCandidate,
        lastMessageAt: fifteenDaysAgo,
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      // 15 days = half of 30 day threshold = 50% bonus
      expect(result.breakdown.recencyBonus).toBeCloseTo(
        ScoringWeights.RECENCY_BONUS_MAX * 0.5,
        1
      )
    })

    it('should give no bonus for old conversation', () => {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const candidate: ConversationCandidate = {
        ...baseCandidate,
        lastMessageAt: sixtyDaysAgo,
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.recencyBonus).toBe(0)
    })

    it('should handle null lastMessageAt', () => {
      const candidate: ConversationCandidate = {
        ...baseCandidate,
        lastMessageAt: null,
      }

      const result = calculateConfidenceScore(candidate, null, '164-1')

      expect(result.breakdown.daysSinceLastMessage).toBeNull()
      expect(result.breakdown.recencyBonus).toBe(0)
    })
  })

  describe('combined scoring', () => {
    it('should combine email match + PO in subject for high score', () => {
      const candidate: ConversationCandidate = {
        conversationId: 'cnv_123',
        subject: 'Re: PO 164-1 - Tracking Update',
        lastMessageAt: new Date(),
        participants: ['customer@example.com'],
      }

      const result = calculateConfidenceScore(
        candidate,
        'customer@example.com',
        '164-1'
      )

      // 0.4 (email) + 0.4 (subject) + ~0.1 (recency) = ~0.9
      expect(result.score).toBeGreaterThanOrEqual(0.8)
      expect(result.breakdown.emailMatched).toBe(true)
      expect(result.breakdown.poInSubject).toBe(true)
    })

    it('should cap score at 1.0', () => {
      const candidate: ConversationCandidate = {
        conversationId: 'cnv_123',
        subject: 'PO 164-1 PO 164-1 PO 164-1', // Repeated
        lastMessageAt: new Date(),
        participants: ['customer@example.com'],
      }

      const result = calculateConfidenceScore(
        candidate,
        'customer@example.com',
        '164-1'
      )

      expect(result.score).toBeLessThanOrEqual(1)
    })
  })
})

describe('getMatchStatus', () => {
  it('should return auto_matched for high confidence', () => {
    expect(getMatchStatus(0.8)).toBe(ThreadMatchStatus.AutoMatched)
    expect(getMatchStatus(0.7)).toBe(ThreadMatchStatus.AutoMatched)
  })

  it('should return pending_review for medium confidence', () => {
    expect(getMatchStatus(0.5)).toBe(ThreadMatchStatus.PendingReview)
    expect(getMatchStatus(0.3)).toBe(ThreadMatchStatus.PendingReview)
  })

  it('should return not_found for low confidence', () => {
    expect(getMatchStatus(0.2)).toBe(ThreadMatchStatus.NotFound)
    expect(getMatchStatus(0)).toBe(ThreadMatchStatus.NotFound)
  })

  it('should use correct threshold boundaries', () => {
    expect(getMatchStatus(ConfidenceThresholds.HIGH)).toBe(ThreadMatchStatus.AutoMatched)
    expect(getMatchStatus(ConfidenceThresholds.HIGH - 0.01)).toBe(ThreadMatchStatus.PendingReview)
    expect(getMatchStatus(ConfidenceThresholds.MEDIUM)).toBe(ThreadMatchStatus.PendingReview)
    expect(getMatchStatus(ConfidenceThresholds.MEDIUM - 0.01)).toBe(ThreadMatchStatus.NotFound)
  })
})
