/**
 * Tracking Notification Service
 * 
 * Sends tracking update notifications to customers via Front conversation replies.
 * Uses thread discovery to find the customer's conversation, then sends templated messages.
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
  /** Front message ID if sent */
  messageId?: string
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
 * Responsible for sending tracking notifications to customers via Front.
 * Handles thread lookup, template rendering, and sending.
 */
export class TrackingNotificationService {
  private frontClient = getFrontClient()

  /**
   * Send a tracking notification for a shipment.
   * 
   * Flow:
   * 1. Look up shipment and linked customer thread
   * 2. Build notification data from shipment/order info
   * 3. Render appropriate template
   * 4. Send reply via Front API
   * 
   * @param context - Shipment and notification details
   * @returns Result with success/failure and message ID
   */
  async sendNotification(context: ShipmentNotificationContext): Promise<NotificationResult> {
    const { shipmentId, notificationType, exceptionReason } = context

    // 1. Get shipment with linked thread
    const shipment = await prisma.shipments.findUnique({
      where: { id: shipmentId },
      include: {
        customer_thread: {
          select: {
            front_conversation_id: true,
            match_status: true,
          },
        },
      },
    })

    if (!shipment) {
      return { 
        success: false, 
        error: `Shipment ${shipmentId} not found` 
      }
    }

    // 2. Check for linked thread
    const thread = shipment.customer_thread
    if (!thread || !thread.front_conversation_id) {
      return {
        success: false,
        skippedReason: 'No linked customer thread',
      }
    }

    // Only send to confirmed threads (auto_matched or manually_linked)
    if (!['auto_matched', 'manually_linked'].includes(thread.match_status)) {
      return {
        success: false,
        skippedReason: `Thread status is ${thread.match_status}, not confirmed`,
      }
    }

    // 3. Get OMG data for customer info (joined by po_number)
    let omgData: Record<string, unknown> | null = null
    if (shipment.po_number) {
      const { normalizePoNumber } = await import('@/lib/infrastructure/omg/sync')
      const normalizedPo = normalizePoNumber(shipment.po_number)
      const omgRecord = await prisma.omg_purchase_orders.findUnique({
        where: { po_number: normalizedPo },
      })
      if (omgRecord) {
        omgData = {
          orderName: omgRecord.order_name,
          orderNumber: omgRecord.order_number,
          customerName: omgRecord.customer_name,
          customerEmail: omgRecord.customer_email,
        }
      }
    }

    // 4. Build notification data
    const customerName = this.extractCustomerName(omgData) || 'there'
    const orderName = (omgData?.orderName as string) || shipment.po_number || 'your order'
    const carrier = shipment.carrier || 'the carrier'
    const trackingNumber = shipment.tracking_number

    const notificationData: TrackingNotificationData = {
      customerName,
      orderName,
      carrier,
      trackingNumber,
      trackingUrl: getTrackingUrl(carrier, trackingNumber),
    }

    // 5. Render template
    const htmlBody = renderTrackingNotification(
      notificationType,
      notificationData,
      exceptionReason
    )

    // 6. Send via Front
    try {
      const message = await this.frontClient.sendReply(
        thread.front_conversation_id,
        htmlBody
      )

      return {
        success: true,
        messageId: message.id,
        conversationId: thread.front_conversation_id,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        conversationId: thread.front_conversation_id,
        error: `Failed to send Front message: ${errorMessage}`,
      }
    }
  }

  /**
   * Send shipped notification
   */
  async sendShippedNotification(shipmentId: number): Promise<NotificationResult> {
    return this.sendNotification({
      shipmentId,
      notificationType: 'shipped',
    })
  }

  /**
   * Send delivered notification
   */
  async sendDeliveredNotification(shipmentId: number): Promise<NotificationResult> {
    return this.sendNotification({
      shipmentId,
      notificationType: 'delivered',
    })
  }

  /**
   * Send out for delivery notification
   */
  async sendOutForDeliveryNotification(shipmentId: number): Promise<NotificationResult> {
    return this.sendNotification({
      shipmentId,
      notificationType: 'out_for_delivery',
    })
  }

  /**
   * Send exception notification
   */
  async sendExceptionNotification(
    shipmentId: number, 
    reason?: string
  ): Promise<NotificationResult> {
    return this.sendNotification({
      shipmentId,
      notificationType: 'exception',
      exceptionReason: reason,
    })
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
