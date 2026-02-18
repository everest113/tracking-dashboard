/**
 * Tracking Notification Service
 * 
 * Creates tracking update notification drafts for customers via Front conversation threads.
 * Uses thread discovery to find the customer's conversation, then creates draft messages
 * that must be manually reviewed and sent by a teammate.
 * 
 * NOTE: This service creates DRAFTS only, never auto-sends to customers.
 */

import { getFrontClient } from '../sdks/front/client'
import { 
  renderTrackingNotification, 
  getTrackingUrl,
  type TrackingNotificationType,
  type TrackingNotificationData 
} from './TrackingNotificationTemplates'
import { prisma } from '@/lib/prisma'

export interface ShipmentNotificationContext {
  /** Shipment ID from database */
  shipmentId: number
  /** Notification type (shipped, delivered, etc.) */
  notificationType: TrackingNotificationType
  /** Exception reason (only for exception type) */
  exceptionReason?: string
}

export interface NotificationResult {
  success: boolean
  /** Front draft message ID if created */
  draftId?: string
  /** Front conversation ID */
  conversationId?: string
  /** Error message if failed */
  error?: string
  /** Reason for skipping (no thread, no email, etc.) */
  skippedReason?: string
}

/**
 * Tracking Notification Service
 * 
 * Responsible for creating tracking notification drafts in Front.
 * Handles thread lookup, template rendering, and draft creation.
 * 
 * NOTE: All notifications are created as drafts for human review before sending.
 */
export class TrackingNotificationService {
  private frontClient = getFrontClient()

  /**
   * Create a tracking notification draft for a shipment.
   * 
   * Flow:
   * 1. Look up shipment and order (thread is stored on order)
   * 2. Build notification data from shipment/order info
   * 3. Render appropriate template
   * 4. Create draft in Front (NOT auto-sent)
   * 
   * @param context - Shipment and notification details
   * @returns Result with success/failure and draft ID
   */
  async createNotificationDraft(context: ShipmentNotificationContext): Promise<NotificationResult> {
    const { shipmentId, notificationType, exceptionReason } = context

    // 1. Get shipment
    const shipment = await prisma.shipments.findUnique({
      where: { id: shipmentId },
    })

    if (!shipment) {
      return { 
        success: false, 
        error: `Shipment ${shipmentId} not found` 
      }
    }

    // 2. Get order with thread info (via PO number -> OMG -> order)
    if (!shipment.po_number) {
      return {
        success: false,
        skippedReason: 'Shipment has no PO number',
      }
    }

    const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
    const normalizedPo = normalizePoNumber(shipment.po_number)
    
    // Find PO record to get order number
    const poRecord = await prisma.purchase_orders.findUnique({
      where: { po_number: normalizedPo },
    })

    if (!poRecord) {
      return {
        success: false,
        skippedReason: `No PO record for ${normalizedPo}`,
      }
    }

    // 3. Get order with thread
    const order = await prisma.orders.findUnique({
      where: { order_number: poRecord.order_number },
    })

    if (!order) {
      return {
        success: false,
        skippedReason: `Order ${poRecord.order_number} not found`,
      }
    }

    // 4. Check for linked thread on order
    if (!order.front_conversation_id) {
      return {
        success: false,
        skippedReason: 'No linked customer thread on order',
      }
    }

    // Only send to confirmed threads (auto_matched or manually_linked)
    if (!['auto_matched', 'manually_linked'].includes(order.thread_match_status)) {
      return {
        success: false,
        skippedReason: `Thread status is ${order.thread_match_status}, not confirmed`,
      }
    }

    // 5. Build notification data
    const customerName = this.extractCustomerName({
      customerName: order.customer_name,
    }) || 'there'
    const orderName = order.order_name || `Order #${order.order_number}`
    const carrier = shipment.carrier || 'the carrier'
    const trackingNumber = shipment.tracking_number

    const notificationData: TrackingNotificationData = {
      customerName,
      orderName,
      carrier,
      trackingNumber,
      trackingUrl: getTrackingUrl(carrier, trackingNumber),
    }

    // 6. Render template
    const htmlBody = renderTrackingNotification(
      notificationType,
      notificationData,
      exceptionReason
    )

    // 7. Create draft in Front (NOT auto-sent)
    try {
      const authorId = process.env.FRONT_AUTHOR_ID
      const channelId = process.env.FRONT_CHANNEL_ID
      
      if (!authorId) {
        return {
          success: false,
          error: 'FRONT_AUTHOR_ID environment variable not set',
        }
      }
      
      if (!channelId) {
        return {
          success: false,
          error: 'FRONT_CHANNEL_ID environment variable not set (use cha_xxx format from Front channels)',
        }
      }

      const draft = await this.frontClient.createDraft(
        order.front_conversation_id,
        htmlBody,
        { author_id: authorId, channel_id: channelId }
      )

      return {
        success: true,
        draftId: draft.id,
        conversationId: order.front_conversation_id,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        conversationId: order.front_conversation_id,
        error: `Failed to create Front draft: ${errorMessage}`,
      }
    }
  }

  /**
   * Create shipped notification draft
   */
  async createShippedDraft(shipmentId: number): Promise<NotificationResult> {
    return this.createNotificationDraft({
      shipmentId,
      notificationType: 'shipped',
    })
  }

  /**
   * Create delivered notification draft
   */
  async createDeliveredDraft(shipmentId: number): Promise<NotificationResult> {
    return this.createNotificationDraft({
      shipmentId,
      notificationType: 'delivered',
    })
  }

  /**
   * Create out for delivery notification draft
   */
  async createOutForDeliveryDraft(shipmentId: number): Promise<NotificationResult> {
    return this.createNotificationDraft({
      shipmentId,
      notificationType: 'out_for_delivery',
    })
  }

  /**
   * Create exception notification draft
   */
  async createExceptionDraft(
    shipmentId: number, 
    reason?: string
  ): Promise<NotificationResult> {
    return this.createNotificationDraft({
      shipmentId,
      notificationType: 'exception',
      exceptionReason: reason,
    })
  }

  /**
   * @deprecated Use createNotificationDraft instead. Alias for backwards compatibility.
   */
  async sendNotification(context: ShipmentNotificationContext): Promise<NotificationResult> {
    return this.createNotificationDraft(context)
  }

  /**
   * Extract customer name from OMG data
   */
  private extractCustomerName(omgData: Record<string, unknown> | null): string | null {
    if (!omgData) return null
    
    // Try different fields that might contain customer name
    const possibleFields = [
      'customerName',
      'customer_name',
      'recipientName',
      'recipient_name',
      'contactName',
      'contact_name',
      'shipToName',
      'ship_to_name',
    ]

    for (const field of possibleFields) {
      const value = omgData[field]
      if (typeof value === 'string' && value.trim()) {
        // Extract first name only for friendlier greeting
        const firstName = value.split(' ')[0]
        return firstName
      }
    }

    return null
  }
}

/**
 * Singleton instance
 */
let instance: TrackingNotificationService | null = null

export function getTrackingNotificationService(): TrackingNotificationService {
  if (!instance) {
    instance = new TrackingNotificationService()
  }
  return instance
}
