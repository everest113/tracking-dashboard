import { NotificationChannel } from '@prisma/client'
import type { NotificationService } from '@/lib/application/notifications/NotificationService'
import { createCompositeNotificationService } from './CompositeNotificationService'
import { createLoggingAdapter } from './adapters/LoggingAdapter'
import { createKnockAdapter } from './adapters/KnockAdapter'

let instance: NotificationService | null = null

/**
 * Get the singleton notification service.
 * 
 * If KNOCK_API_KEY is set, uses Knock for all notifications.
 * Otherwise, falls back to logging adapters for development.
 */
export function getNotificationService(): NotificationService {
  if (!instance) {
    const knockApiKey = process.env.KNOCK_API_KEY

    if (knockApiKey) {
      // Use Knock for production
      instance = createKnockAdapter(knockApiKey)
    } else {
      // Fallback: logging adapters for all channels (development)
      const adapters = [
        createLoggingAdapter(NotificationChannel.EMAIL),
        createLoggingAdapter(NotificationChannel.SLACK),
        createLoggingAdapter(NotificationChannel.WEBHOOK),
        createLoggingAdapter(NotificationChannel.SMS),
      ]
      instance = createCompositeNotificationService(adapters)
    }
  }
  return instance
}

/**
 * Reset the singleton (useful for testing or config changes).
 */
export function resetNotificationService(): void {
  instance = null
}
