/**
 * Prisma implementation of Order Thread Repository.
 * Handles customer thread data stored on the orders table.
 */

import type { PrismaClient, ThreadMatchStatus as PrismaThreadMatchStatus } from '@prisma/client'
import type {
  OrderThreadLink,
  UpdateOrderThreadInput,
  ThreadMatchStatusType,
} from '@/lib/domain/customer-thread'
import { ThreadMatchStatus } from '@/lib/domain/customer-thread'

/**
 * Map Prisma order record to OrderThreadLink.
 */
function toThreadLink(record: {
  order_number: string
  front_conversation_id: string | null
  thread_match_status: PrismaThreadMatchStatus
  thread_confidence_score: number | null
  thread_email_matched: boolean
  thread_order_in_subject: boolean
  thread_order_in_body: boolean
  thread_days_since_message: number | null
  thread_matched_email: string | null
  thread_conversation_subject: string | null
  thread_reviewed_at: Date | null
  thread_reviewed_by: string | null
}): OrderThreadLink {
  return {
    orderNumber: record.order_number,
    frontConversationId: record.front_conversation_id,
    matchStatus: record.thread_match_status as ThreadMatchStatusType,
    confidenceScore: record.thread_confidence_score,
    emailMatched: record.thread_email_matched,
    orderInSubject: record.thread_order_in_subject,
    orderInBody: record.thread_order_in_body,
    daysSinceLastMessage: record.thread_days_since_message,
    matchedEmail: record.thread_matched_email,
    conversationSubject: record.thread_conversation_subject,
    reviewedAt: record.thread_reviewed_at,
    reviewedBy: record.thread_reviewed_by,
  }
}

/**
 * Map domain status to Prisma enum.
 */
function toPrismaStatus(status: ThreadMatchStatusType): PrismaThreadMatchStatus {
  const map: Record<string, PrismaThreadMatchStatus> = {
    [ThreadMatchStatus.AutoMatched]: 'auto_matched',
    [ThreadMatchStatus.PendingReview]: 'pending_review',
    [ThreadMatchStatus.ManuallyLinked]: 'manually_linked',
    [ThreadMatchStatus.Rejected]: 'rejected',
    [ThreadMatchStatus.NotFound]: 'not_found',
  }
  return map[status] ?? 'not_found'
}

export interface OrderThreadRepository {
  getByOrderNumber(orderNumber: string): Promise<OrderThreadLink | null>
  updateThread(input: UpdateOrderThreadInput): Promise<OrderThreadLink>
  updateStatus(orderNumber: string, status: ThreadMatchStatusType, reviewedBy?: string): Promise<OrderThreadLink>
  linkConversation(orderNumber: string, conversationId: string, reviewedBy: string): Promise<OrderThreadLink>
  clearThread(orderNumber: string): Promise<void>
  getOrdersNeedingReview(limit?: number): Promise<OrderThreadLink[]>
  getLinkedOrders(limit?: number): Promise<OrderThreadLink[]>
}

export function createOrderThreadRepository(prisma: PrismaClient): OrderThreadRepository {
  const selectThreadFields = {
    order_number: true,
    front_conversation_id: true,
    thread_match_status: true,
    thread_confidence_score: true,
    thread_email_matched: true,
    thread_order_in_subject: true,
    thread_order_in_body: true,
    thread_days_since_message: true,
    thread_matched_email: true,
    thread_conversation_subject: true,
    thread_reviewed_at: true,
    thread_reviewed_by: true,
  } as const

  return {
    async getByOrderNumber(orderNumber: string): Promise<OrderThreadLink | null> {
      const record = await prisma.orders.findUnique({
        where: { order_number: orderNumber },
        select: selectThreadFields,
      })
      return record ? toThreadLink(record) : null
    },

    async updateThread(input: UpdateOrderThreadInput): Promise<OrderThreadLink> {
      const record = await prisma.orders.update({
        where: { order_number: input.orderNumber },
        data: {
          front_conversation_id: input.frontConversationId,
          thread_match_status: toPrismaStatus(input.matchStatus),
          thread_confidence_score: input.confidenceScore,
          thread_email_matched: input.emailMatched,
          thread_order_in_subject: input.orderInSubject,
          thread_order_in_body: input.orderInBody,
          thread_days_since_message: input.daysSinceLastMessage,
          thread_matched_email: input.matchedEmail,
          thread_conversation_subject: input.conversationSubject,
        },
        select: selectThreadFields,
      })
      return toThreadLink(record)
    },

    async updateStatus(
      orderNumber: string,
      status: ThreadMatchStatusType,
      reviewedBy?: string
    ): Promise<OrderThreadLink> {
      const record = await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          thread_match_status: toPrismaStatus(status),
          thread_reviewed_at: new Date(),
          thread_reviewed_by: reviewedBy ?? null,
        },
        select: selectThreadFields,
      })
      return toThreadLink(record)
    },

    async linkConversation(
      orderNumber: string,
      conversationId: string,
      reviewedBy: string
    ): Promise<OrderThreadLink> {
      const record = await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          front_conversation_id: conversationId,
          thread_match_status: 'manually_linked',
          thread_reviewed_at: new Date(),
          thread_reviewed_by: reviewedBy,
        },
        select: selectThreadFields,
      })
      return toThreadLink(record)
    },

    async clearThread(orderNumber: string): Promise<void> {
      await prisma.orders.update({
        where: { order_number: orderNumber },
        data: {
          front_conversation_id: null,
          thread_match_status: 'not_found',
          thread_confidence_score: null,
          thread_email_matched: false,
          thread_order_in_subject: false,
          thread_order_in_body: false,
          thread_days_since_message: null,
          thread_matched_email: null,
          thread_conversation_subject: null,
          thread_reviewed_at: null,
          thread_reviewed_by: null,
        },
      })
    },

    async getOrdersNeedingReview(limit = 50): Promise<OrderThreadLink[]> {
      const records = await prisma.orders.findMany({
        where: {
          thread_match_status: { in: ['pending_review', 'not_found'] },
        },
        orderBy: [
          { thread_match_status: 'asc' }, // pending_review before not_found
          { thread_confidence_score: 'desc' },
        ],
        take: limit,
        select: selectThreadFields,
      })
      return records.map(toThreadLink)
    },

    async getLinkedOrders(limit = 100): Promise<OrderThreadLink[]> {
      const records = await prisma.orders.findMany({
        where: {
          thread_match_status: { in: ['auto_matched', 'manually_linked'] },
          front_conversation_id: { not: null },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
        select: selectThreadFields,
      })
      return records.map(toThreadLink)
    },
  }
}
