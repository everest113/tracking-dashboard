/**
 * Customer Thread Router (Order-based)
 * 
 * Handles thread discovery and management at the ORDER level.
 * Threads are linked to orders, not individual shipments.
 */

import { z } from 'zod'
import { publicProcedure } from './base'

// =============================================================================
// SCHEMAS
// =============================================================================

const OrderThreadLinkSchema = z.object({
  orderNumber: z.string(),
  frontConversationId: z.string().nullable(),
  matchStatus: z.enum(['auto_matched', 'pending_review', 'manually_linked', 'rejected', 'not_found']),
  confidenceScore: z.number().nullable(),
  emailMatched: z.boolean(),
  orderInSubject: z.boolean(),
  orderInBody: z.boolean(),
  daysSinceLastMessage: z.number().nullable(),
  matchedEmail: z.string().nullable(),
  conversationSubject: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.string().nullable(),
})

const OrderReviewItemSchema = z.object({
  order: z.object({
    orderNumber: z.string(),
    orderName: z.string().nullable(),
    customerName: z.string().nullable(),
    customerEmail: z.string().nullable(),
    shipmentCount: z.number(),
    computedStatus: z.string(),
  }),
  thread: OrderThreadLinkSchema,
})

// =============================================================================
// ROUTER
// =============================================================================

export const customerThreadRouter = {
  /**
   * Get orders needing thread review
   */
  getPendingReviews: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .output(z.object({
      items: z.array(OrderReviewItemSchema),
      total: z.number(),
    }))
    .handler(async ({ context, input }) => {
      const limit = input?.limit ?? 50
      
      // Get orders with pending/not_found thread status
      const orders = await context.prisma.orders.findMany({
        where: {
          thread_match_status: { in: ['pending_review', 'not_found'] },
        },
        orderBy: [
          { thread_match_status: 'asc' },
          { thread_confidence_score: 'desc' },
        ],
        take: limit,
      })
      
      const items = orders.map(order => ({
        order: {
          orderNumber: order.order_number,
          orderName: order.order_name,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          shipmentCount: order.shipment_count,
          computedStatus: order.computed_status,
        },
        thread: {
          orderNumber: order.order_number,
          frontConversationId: order.front_conversation_id,
          matchStatus: order.thread_match_status as 'auto_matched' | 'pending_review' | 'manually_linked' | 'rejected' | 'not_found',
          confidenceScore: order.thread_confidence_score,
          emailMatched: order.thread_email_matched,
          orderInSubject: order.thread_order_in_subject,
          orderInBody: order.thread_order_in_body,
          daysSinceLastMessage: order.thread_days_since_message,
          matchedEmail: order.thread_matched_email,
          conversationSubject: order.thread_conversation_subject,
          reviewedAt: order.thread_reviewed_at?.toISOString() ?? null,
          reviewedBy: order.thread_reviewed_by,
        },
      }))
      
      const total = await context.prisma.orders.count({
        where: {
          thread_match_status: { in: ['pending_review', 'not_found'] },
        },
      })
      
      return { items, total }
    }),

  /**
   * Trigger thread discovery for an order
   */
  triggerDiscovery: publicProcedure
    .input(z.object({
      orderNumber: z.string(),
    }))
    .output(z.object({
      status: z.enum(['linked', 'pending_review', 'not_found', 'already_linked']),
      threadLink: OrderThreadLinkSchema.nullable(),
      candidatesFound: z.number(),
      topScore: z.number().nullable(),
      reason: z.string().nullable(),
    }))
    .handler(async ({ context, input }) => {
      const { getOrderThreadDiscoveryService } = await import('@/lib/infrastructure/customer-thread')
      
      // Get order
      const order = await context.prisma.orders.findUnique({
        where: { order_number: input.orderNumber },
      })
      
      if (!order) {
        throw new Error('Order not found')
      }
      
      const discoveryService = await getOrderThreadDiscoveryService()
      const result = await discoveryService.discoverThread({
        orderNumber: order.order_number,
        customerEmail: order.customer_email,
        orderName: order.order_name,
      })
      
      // Determine reason if not found
      let reason: string | null = null
      if (result.status === 'not_found') {
        if (result.candidatesFound === 0) {
          reason = `No Front conversations found for ${order.customer_email || 'order'}`
        } else {
          reason = `${result.candidatesFound} conversation(s) found but confidence too low (${Math.round((result.topScore ?? 0) * 100)}%)`
        }
      }
      
      return {
        status: result.status,
        threadLink: result.threadLink ? {
          ...result.threadLink,
          reviewedAt: result.threadLink.reviewedAt?.toISOString() ?? null,
        } : null,
        candidatesFound: result.candidatesFound,
        topScore: result.topScore,
        reason,
      }
    }),

  /**
   * Approve a pending thread match
   */
  approve: publicProcedure
    .input(z.object({
      orderNumber: z.string(),
      reviewedBy: z.string().default('user'),
    }))
    .output(z.object({
      success: z.boolean(),
      threadLink: OrderThreadLinkSchema,
    }))
    .handler(async ({ context, input }) => {
      const { getOrderThreadRepository } = await import('@/lib/infrastructure/customer-thread')
      const { getAuditService } = await import('@/lib/infrastructure/audit')
      const { AuditEntityTypes, AuditActions } = await import('@/lib/domain/audit')
      
      const repository = getOrderThreadRepository()
      const audit = getAuditService()
      
      const updated = await repository.updateStatus(
        input.orderNumber,
        'manually_linked',
        input.reviewedBy
      )
      
      // Record audit entry
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Order,
        entityId: input.orderNumber,
        action: AuditActions.ThreadManuallyLinked,
        actor: `user:${input.reviewedBy}`,
        metadata: {
          conversationId: updated.frontConversationId,
          previousStatus: 'pending_review',
          newStatus: 'manually_linked',
          confidenceScore: updated.confidenceScore,
        },
      })
      
      // Emit domain event for catch-up notifications
      const { domainEvents } = await import('@/lib/domain/events')
      domainEvents.emit('ThreadLinked', {
        orderNumber: input.orderNumber,
        conversationId: updated.frontConversationId!,
        matchType: 'manually_linked',
      })
      
      return {
        success: true,
        threadLink: {
          ...updated,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        },
      }
    }),

  /**
   * Reject a pending thread match
   */
  reject: publicProcedure
    .input(z.object({
      orderNumber: z.string(),
      reviewedBy: z.string().default('user'),
    }))
    .output(z.object({
      success: z.boolean(),
    }))
    .handler(async ({ context, input }) => {
      const { getOrderThreadRepository } = await import('@/lib/infrastructure/customer-thread')
      const { getAuditService } = await import('@/lib/infrastructure/audit')
      const { AuditEntityTypes, AuditActions } = await import('@/lib/domain/audit')
      
      const repository = getOrderThreadRepository()
      const audit = getAuditService()
      
      // Get current state before update
      const current = await repository.getByOrderNumber(input.orderNumber)
      
      await repository.updateStatus(
        input.orderNumber,
        'rejected',
        input.reviewedBy
      )
      
      // Record audit entry
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Order,
        entityId: input.orderNumber,
        action: AuditActions.ThreadRejected,
        actor: `user:${input.reviewedBy}`,
        metadata: {
          conversationId: current?.frontConversationId,
          previousStatus: current?.matchStatus,
          newStatus: 'rejected',
          confidenceScore: current?.confidenceScore,
        },
      })
      
      return { success: true }
    }),

  /**
   * Link an order to a different conversation (manual override)
   */
  linkDifferent: publicProcedure
    .input(z.object({
      orderNumber: z.string(),
      newConversationId: z.string(),
      reviewedBy: z.string().default('user'),
    }))
    .output(z.object({
      success: z.boolean(),
      threadLink: OrderThreadLinkSchema,
    }))
    .handler(async ({ context, input }) => {
      const { getOrderThreadRepository } = await import('@/lib/infrastructure/customer-thread')
      const { getAuditService } = await import('@/lib/infrastructure/audit')
      const { AuditEntityTypes, AuditActions } = await import('@/lib/domain/audit')
      
      const repository = getOrderThreadRepository()
      const audit = getAuditService()
      
      // Get current state before update
      const current = await repository.getByOrderNumber(input.orderNumber)
      
      const updated = await repository.linkConversation(
        input.orderNumber,
        input.newConversationId,
        input.reviewedBy
      )
      
      // Record audit entry
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Order,
        entityId: input.orderNumber,
        action: AuditActions.ThreadManuallyLinked,
        actor: `user:${input.reviewedBy}`,
        metadata: {
          previousConversationId: current?.frontConversationId,
          newConversationId: input.newConversationId,
          previousStatus: current?.matchStatus,
          newStatus: 'manually_linked',
        },
      })
      
      // Emit domain event for catch-up notifications
      const { domainEvents } = await import('@/lib/domain/events')
      domainEvents.emit('ThreadLinked', {
        orderNumber: input.orderNumber,
        conversationId: input.newConversationId,
        matchType: 'manually_linked',
        previousConversationId: current?.frontConversationId,
      })
      
      return {
        success: true,
        threadLink: {
          ...updated,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        },
      }
    }),

  /**
   * Get thread link for a specific order
   */
  getByOrder: publicProcedure
    .input(z.object({
      orderNumber: z.string(),
    }))
    .output(z.object({
      threadLink: OrderThreadLinkSchema.nullable(),
    }))
    .handler(async ({ context, input }) => {
      const { getOrderThreadRepository } = await import('@/lib/infrastructure/customer-thread')
      
      const repository = getOrderThreadRepository()
      const link = await repository.getByOrderNumber(input.orderNumber)
      
      return {
        threadLink: link ? {
          ...link,
          reviewedAt: link.reviewedAt?.toISOString() ?? null,
        } : null,
      }
    }),

  /**
   * Search Front conversations for manual linking
   */
  searchConversations: publicProcedure
    .input(z.object({
      email: z.string().email(),
      limit: z.number().min(1).max(50).default(25),
    }))
    .output(z.object({
      conversations: z.array(z.object({
        id: z.string(),
        subject: z.string().nullable(),
        createdAt: z.string(),
        recipientEmail: z.string().nullable(),
      })),
    }))
    .handler(async ({ context, input }) => {
      const { searchConversationsByEmail } = await import('@/lib/infrastructure/sdks/front/client')
      
      const results = await searchConversationsByEmail(input.email, { limit: input.limit })
      
      return {
        conversations: results.map((conv) => ({
          id: conv.id,
          subject: conv.subject ?? null,
          createdAt: new Date(conv.created_at * 1000).toISOString(),
          recipientEmail: conv.recipient?.handle ?? null,
        })),
      }
    }),

  /**
   * Create a tracking notification draft for the customer in Front
   * NOTE: Creates drafts only, never auto-sends
   */
  createNotificationDraft: publicProcedure
    .input(z.object({
      shipmentId: z.number(),
      notificationType: z.enum(['shipped', 'out_for_delivery', 'delivered', 'exception']),
      exceptionReason: z.string().optional(),
    }))
    .output(z.object({
      success: z.boolean(),
      draftId: z.string().nullable(),
      conversationId: z.string().nullable(),
      error: z.string().nullable(),
      skippedReason: z.string().nullable(),
    }))
    .handler(async ({ context, input }) => {
      const { getTrackingNotificationService } = await import('@/lib/infrastructure/customer-thread')
      
      const service = getTrackingNotificationService()
      const result = await service.createNotificationDraft({
        shipmentId: input.shipmentId,
        notificationType: input.notificationType,
        exceptionReason: input.exceptionReason,
      })
      
      return {
        success: result.success,
        draftId: result.draftId ?? null,
        conversationId: result.conversationId ?? null,
        error: result.error ?? null,
        skippedReason: result.skippedReason ?? null,
      }
    }),
}
