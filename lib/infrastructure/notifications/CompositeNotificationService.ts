import type { NotificationChannel } from '@prisma/client'
import type { ChannelAdapter } from '@/lib/application/notifications/ChannelAdapter'
import type { NotificationService } from '@/lib/application/notifications/NotificationService'
import type { NotificationPayload, SendResult } from '@/lib/application/notifications/types'

/**
 * Composite notification service that routes to channel-specific adapters.
 */
export function createCompositeNotificationService(
  adapters: ChannelAdapter[]
): NotificationService {
  const adapterMap = new Map<NotificationChannel, ChannelAdapter>()
  for (const adapter of adapters) {
    adapterMap.set(adapter.channel, adapter)
  }

  return {
    async send(payload: NotificationPayload): Promise<SendResult> {
      const adapter = adapterMap.get(payload.channel)
      if (!adapter) {
        return {
          success: false,
          error: `No adapter registered for channel: ${payload.channel}`,
        }
      }
      return adapter.send(payload)
    },
  }
}
