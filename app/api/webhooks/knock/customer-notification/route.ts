/**
 * Knock Webhook - Customer Notification
 * 
 * Called by Knock when a customer tracking notification workflow step executes.
 * Creates a DRAFT notification in Front for human review before sending.
 * 
 * NOTE: This creates drafts only, never auto-sends to customers.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTrackingNotificationService } from '@/lib/infrastructure/customer-thread'
import { getAuditService } from '@/lib/infrastructure/audit'
import { AuditEntityTypes, AuditActions } from '@/lib/domain/audit'

// Knock webhook payload schema
const KnockWebhookPayloadSchema = z.object({
  // Knock metadata
  id: z.string(), // Workflow run ID
  workflow: z.string(),
  
  // Recipient info
  recipient: z.object({
    id: z.string(), // Shipment ID
    collection: z.string().optional(),
  }),
  
  // Our notification data
  data: z.object({
    shipmentId: z.number(),
    notificationType: z.enum(['shipped', 'out_for_delivery', 'delivered', 'exception']),
    exceptionReason: z.string().optional(),
  }),
})

export async function POST(request: Request) {
  const audit = getAuditService()
  
  try {
    const body = await request.json()
    
    // Validate payload
    const parseResult = KnockWebhookPayloadSchema.safeParse(body)
    if (!parseResult.success) {
      console.error('[Knock Webhook] Invalid payload:', parseResult.error)
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const { data, id: workflowRunId, recipient } = parseResult.data
    const { shipmentId, notificationType, exceptionReason } = data
    
    console.log(`[Knock Webhook] Processing customer notification draft`, {
      workflowRunId,
      shipmentId,
      notificationType,
    })
    
    // Create notification draft in Front (NOT auto-sent)
    const notificationService = getTrackingNotificationService()
    const result = await notificationService.createNotificationDraft({
      shipmentId,
      notificationType,
      exceptionReason,
    })
    
    // Audit the result
    if (result.success) {
      await audit.recordSuccess({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.NotificationDraftCreated,
        actor: 'system:knock-webhook',
        metadata: {
          notificationType,
          conversationId: result.conversationId,
          draftId: result.draftId,
          workflowRunId,
          channel: 'front',
        },
      })
      
      console.log(`[Knock Webhook] Notification draft created`, {
        shipmentId,
        notificationType,
        conversationId: result.conversationId,
        draftId: result.draftId,
      })
      
      return NextResponse.json({ success: true, draftId: result.draftId })
    } else if (result.skippedReason) {
      await audit.recordSkipped({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.NotificationSkipped,
        actor: 'system:knock-webhook',
        metadata: {
          notificationType,
          reason: result.skippedReason,
          workflowRunId,
          channel: 'front',
        },
      })
      
      console.log(`[Knock Webhook] Notification skipped`, {
        shipmentId,
        notificationType,
        reason: result.skippedReason,
      })
      
      // Return success so Knock doesn't retry (skip is intentional)
      return NextResponse.json({ success: true, skipped: true, reason: result.skippedReason })
    } else {
      await audit.recordFailure({
        entityType: AuditEntityTypes.Shipment,
        entityId: String(shipmentId),
        action: AuditActions.NotificationFailed,
        actor: 'system:knock-webhook',
        error: result.error || 'Unknown error',
        metadata: {
          notificationType,
          conversationId: result.conversationId,
          workflowRunId,
          channel: 'front',
        },
      })
      
      console.error(`[Knock Webhook] Notification failed`, {
        shipmentId,
        notificationType,
        error: result.error,
      })
      
      // Return 500 so Knock retries
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Knock Webhook] Error:', message)
    
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
