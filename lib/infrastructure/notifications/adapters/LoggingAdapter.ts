import type { NotificationChannel } from '@prisma/client'
import type { ChannelAdapter } from '@/lib/application/notifications/ChannelAdapter'
import type { NotificationPayload, SendResult } from '@/lib/application/notifications/types'

/**
 * Logging adapter - logs notifications to console instead of sending.
 * Useful for development and testing.
 */
export function createLoggingAdapter(channel: NotificationChannel): ChannelAdapter {
  return {
    channel,
    async send(payload: NotificationPayload): Promise<SendResult> {
      console.log(`[notification:${channel}] to=${payload.recipient}`, {
        subject: payload.subject,
        body: payload.body.substring(0, 200),
        metadata: payload.metadata,
      })
      return {
        success: true,
        providerId: `log-${Date.now()}`,
      }
    },
  }
}
