import type { NotificationChannel } from '@prisma/client'
import { getNotificationQueue } from '@/lib/infrastructure/notifications/PrismaNotificationQueue'
import { getNotificationService } from '@/lib/infrastructure/notifications'
import type { ClaimOptions } from './NotificationQueue'

const DEFAULT_BATCH_SIZE = 25

export type DispatchResult = {
  channel: NotificationChannel
  processed: number
  errors: number
}

/**
 * Dispatch notifications for a specific channel.
 * Claims pending notifications, sends them, and marks them as sent or failed.
 */
export async function dispatchNotifications(
  channel: NotificationChannel,
  options?: ClaimOptions
): Promise<DispatchResult> {
  const queue = getNotificationQueue()
  const service = getNotificationService()

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const notifications = await queue.claim(channel, { ...options, batchSize })

  let processed = 0
  let errors = 0
  const sentIds: string[] = []

  for (const notification of notifications) {
    try {
      const result = await service.send({
        channel: notification.channel,
        recipient: notification.recipient,
        subject: notification.subject ?? undefined,
        body: notification.body,
        metadata: notification.metadata ?? undefined,
      })

      if (result.success) {
        sentIds.push(notification.id)
        processed++
      } else {
        errors++
        await queue.markFailed(notification.id, result.error ?? 'Unknown error')
      }
    } catch (error) {
      errors++
      const message = error instanceof Error ? error.message : JSON.stringify(error)
      await queue.markFailed(notification.id, message)
    }
  }

  // Batch mark sent
  if (sentIds.length > 0) {
    await queue.markSent(sentIds)
  }

  return { channel, processed, errors }
}

/**
 * Dispatch notifications for all channels.
 */
export async function dispatchAllChannels(
  options?: ClaimOptions
): Promise<DispatchResult[]> {
  const channels: NotificationChannel[] = ['EMAIL', 'SLACK', 'WEBHOOK', 'SMS']
  const results: DispatchResult[] = []

  for (const channel of channels) {
    const result = await dispatchNotifications(channel, options)
    results.push(result)
  }

  return results
}
