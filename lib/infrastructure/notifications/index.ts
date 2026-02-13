import { NotificationChannel } from '@prisma/client'
import type { NotificationService } from '@/lib/application/notifications/NotificationService'
import { createCompositeNotificationService } from './CompositeNotificationService'
import { createLoggingAdapter } from './adapters/LoggingAdapter'

let instance: NotificationService | null = null

/**
 * Get the singleton notification service.
 * Uses logging adapters by default; swap in real adapters (SES, Slack, etc.) via config.
 */
export function getNotificationService(): NotificationService {
  if (!instance) {
    // Default: logging adapters for all channels
    const adapters = [
      createLoggingAdapter(NotificationChannel.EMAIL),
      createLoggingAdapter(NotificationChannel.SLACK),
      createLoggingAdapter(NotificationChannel.WEBHOOK),
      createLoggingAdapter(NotificationChannel.SMS),
    ]
    instance = createCompositeNotificationService(adapters)
  }
  return instance
}
