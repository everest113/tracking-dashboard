import type { NotificationChannel } from '@prisma/client'
import type { NotificationPayload, QueuedNotification } from './types'

export type EnqueueOptions = {
  ruleId?: string
  eventId?: string
  scheduledFor?: Date
}

export type ClaimOptions = {
  batchSize?: number
  visibilityTimeoutMs?: number
}

export interface NotificationQueue {
  enqueue(payloads: NotificationPayload[], options?: EnqueueOptions): Promise<void>
  claim(channel: NotificationChannel, options?: ClaimOptions): Promise<QueuedNotification[]>
  markSent(ids: string[], providerId?: string): Promise<void>
  markFailed(id: string, error: string, retryAt?: Date): Promise<void>
}
