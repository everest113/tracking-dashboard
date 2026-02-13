import type { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client'
import type { NotificationQueue, EnqueueOptions, ClaimOptions } from '@/lib/application/notifications/NotificationQueue'
import type { NotificationPayload, QueuedNotification } from '@/lib/application/notifications/types'
import { prisma } from '@/lib/prisma'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_VISIBILITY_TIMEOUT_MS = 60_000
const DEFAULT_RETRY_DELAY_MS = 30_000

type NotificationQueueRow = {
  id: string
  rule_id: string | null
  event_id: string | null
  channel: NotificationChannel
  recipient: string
  subject: string | null
  body: string
  metadata: Prisma.JsonValue
  status: NotificationStatus
  attempts: number
  max_attempts: number
  available_at: Date
  locked_at: Date | null
  sent_at: Date | null
  last_error: string | null
  created_at: Date
  updated_at: Date
}

export function createPrismaNotificationQueue(prismaClient = prisma): NotificationQueue {
  const mapRow = (row: NotificationQueueRow): QueuedNotification => ({
    id: row.id,
    ruleId: row.rule_id,
    eventId: row.event_id,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    metadata: row.metadata as Record<string, unknown> | null,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    lockedAt: row.locked_at,
    lastError: row.last_error,
  })

  return {
    async enqueue(payloads: NotificationPayload[], options?: EnqueueOptions): Promise<void> {
      if (!payloads.length) return

      await prismaClient.notification_queue.createMany({
        data: payloads.map((payload) => ({
          rule_id: options?.ruleId,
          event_id: options?.eventId,
          channel: payload.channel,
          recipient: payload.recipient,
          subject: payload.subject,
          body: payload.body,
          metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue,
          available_at: options?.scheduledFor ?? new Date(),
        })),
      })
    },

    async claim(channel: NotificationChannel, options?: ClaimOptions): Promise<QueuedNotification[]> {
      const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
      const visibilityTimeout = options?.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS

      if (batchSize <= 0) {
        return []
      }

      const rows = await prismaClient.$transaction(async (tx) => {
        const result = await tx.$queryRaw<NotificationQueueRow[]>`
          UPDATE notification_queue
          SET status = 'PROCESSING',
              locked_at = NOW(),
              attempts = attempts + 1,
              available_at = NOW() + (${visibilityTimeout}::int * interval '1 millisecond')
          WHERE id IN (
            SELECT id
            FROM notification_queue
            WHERE channel = ${channel}::"NotificationChannel"
              AND status IN ('PENDING', 'FAILED')
              AND available_at <= NOW()
              AND attempts < max_attempts
            ORDER BY available_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${batchSize}
          )
          RETURNING *;
        `
        return result
      })

      return rows.map(mapRow)
    },

    async markSent(ids: string[], providerId?: string): Promise<void> {
      if (!ids.length) return

      await prismaClient.$transaction(async (tx) => {
        // Update queue status
        await tx.notification_queue.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'SENT',
            locked_at: null,
            sent_at: new Date(),
            last_error: null,
          },
        })

        // Log sent notifications
        const notifications = await tx.notification_queue.findMany({
          where: { id: { in: ids } },
        })

        await tx.notification_log.createMany({
          data: notifications.map((n) => ({
            queue_id: n.id,
            channel: n.channel,
            recipient: n.recipient,
            subject: n.subject,
            body: n.body,
            status: 'SENT',
            provider_id: providerId,
            metadata: n.metadata ?? undefined,
          })),
        })
      })
    },

    async markFailed(id: string, error: string, retryAt?: Date): Promise<void> {
      await prismaClient.$transaction(async (tx) => {
        const record = await tx.notification_queue.findUnique({ where: { id } })
        if (!record) return

        const hasAttemptsRemaining = record.attempts < record.max_attempts

        await tx.notification_queue.update({
          where: { id },
          data: {
            status: hasAttemptsRemaining ? 'PENDING' : 'FAILED',
            available_at: hasAttemptsRemaining
              ? (retryAt ?? new Date(Date.now() + DEFAULT_RETRY_DELAY_MS))
              : record.available_at,
            locked_at: null,
            last_error: error,
          },
        })

        // Log failed notification if no more attempts
        if (!hasAttemptsRemaining) {
          await tx.notification_log.create({
            data: {
              queue_id: record.id,
              channel: record.channel,
              recipient: record.recipient,
              subject: record.subject,
              body: record.body,
              status: 'FAILED',
              metadata: record.metadata ?? undefined,
            },
          })
        }
      })
    },
  }
}

let instance: NotificationQueue | null = null

export function getNotificationQueue(): NotificationQueue {
  if (!instance) {
    instance = createPrismaNotificationQueue()
  }
  return instance
}
