/**
 * Prisma implementation of CustomerThreadRepository.
 */

import type { PrismaClient } from '@prisma/client'
import type {
  CustomerThreadRepository,
  CustomerThreadLink,
  CreateCustomerThreadInput,
  ThreadMatchStatusType,
} from '@/lib/domain/customer-thread'

/**
 * Map Prisma record to domain entity.
 */
function toDomain(record: {
  id: number
  shipment_id: number
  front_conversation_id: string
  confidence_score: number
  match_status: string
  email_matched: boolean
  order_in_subject: boolean
  order_in_body: boolean
  days_since_last_message: number | null
  matched_email: string | null
  conversation_subject: string | null
  created_at: Date
  updated_at: Date
  reviewed_at: Date | null
  reviewed_by: string | null
}): CustomerThreadLink {
  return {
    id: record.id,
    shipmentId: record.shipment_id,
    frontConversationId: record.front_conversation_id,
    confidenceScore: record.confidence_score,
    matchStatus: record.match_status as ThreadMatchStatusType,
    emailMatched: record.email_matched,
    orderInSubject: record.order_in_subject,
    orderInBody: record.order_in_body,
    daysSinceLastMessage: record.days_since_last_message,
    matchedEmail: record.matched_email,
    conversationSubject: record.conversation_subject,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    reviewedAt: record.reviewed_at,
    reviewedBy: record.reviewed_by,
  }
}

/**
 * Map match status to Prisma enum.
 */
function toPrismaStatus(status: ThreadMatchStatusType) {
  const map: Record<string, 'auto_matched' | 'pending_review' | 'manually_linked' | 'rejected' | 'not_found'> = {
    auto_matched: 'auto_matched',
    pending_review: 'pending_review',
    manually_linked: 'manually_linked',
    rejected: 'rejected',
    not_found: 'not_found',
  }
  return map[status] ?? 'pending_review'
}

export function createPrismaCustomerThreadRepository(
  prisma: PrismaClient
): CustomerThreadRepository {
  return {
    async create(input: CreateCustomerThreadInput): Promise<CustomerThreadLink> {
      const record = await prisma.shipment_customer_threads.create({
        data: {
          shipment_id: input.shipmentId,
          front_conversation_id: input.frontConversationId,
          confidence_score: input.confidenceScore,
          match_status: toPrismaStatus(input.matchStatus),
          email_matched: input.emailMatched,
          order_in_subject: input.orderInSubject,
          order_in_body: input.orderInBody,
          days_since_last_message: input.daysSinceLastMessage,
          matched_email: input.matchedEmail,
          conversation_subject: input.conversationSubject,
        },
      })
      return toDomain(record)
    },

    async getByShipmentId(shipmentId: number): Promise<CustomerThreadLink | null> {
      const record = await prisma.shipment_customer_threads.findUnique({
        where: { shipment_id: shipmentId },
      })
      return record ? toDomain(record) : null
    },

    async getByConversationId(conversationId: string): Promise<CustomerThreadLink[]> {
      const records = await prisma.shipment_customer_threads.findMany({
        where: { front_conversation_id: conversationId },
      })
      return records.map(toDomain)
    },

    async updateStatus(
      shipmentId: number,
      status: ThreadMatchStatusType,
      reviewedBy?: string
    ): Promise<CustomerThreadLink> {
      const record = await prisma.shipment_customer_threads.update({
        where: { shipment_id: shipmentId },
        data: {
          match_status: toPrismaStatus(status),
          reviewed_at: new Date(),
          reviewed_by: reviewedBy ?? null,
        },
      })
      return toDomain(record)
    },

    async updateConversation(
      shipmentId: number,
      newConversationId: string,
      reviewedBy: string
    ): Promise<CustomerThreadLink> {
      const record = await prisma.shipment_customer_threads.update({
        where: { shipment_id: shipmentId },
        data: {
          front_conversation_id: newConversationId,
          match_status: 'manually_linked',
          reviewed_at: new Date(),
          reviewed_by: reviewedBy,
        },
      })
      return toDomain(record)
    },

    async getPendingReview(limit = 50): Promise<CustomerThreadLink[]> {
      const records = await prisma.shipment_customer_threads.findMany({
        where: { match_status: 'pending_review' },
        orderBy: { confidence_score: 'desc' },
        take: limit,
      })
      return records.map(toDomain)
    },

    async delete(shipmentId: number): Promise<void> {
      await prisma.shipment_customer_threads.delete({
        where: { shipment_id: shipmentId },
      })
    },

    async exists(shipmentId: number): Promise<boolean> {
      const count = await prisma.shipment_customer_threads.count({
        where: { shipment_id: shipmentId },
      })
      return count > 0
    },
  }
}
