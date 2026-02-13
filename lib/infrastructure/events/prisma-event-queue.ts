import type { EventStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

import type { EventQueue } from '@/lib/application/events/EventQueue'
import type { ClaimOptions, EventMessage, QueuedEvent } from '@/lib/application/events/types'
import { prisma } from '@/lib/prisma'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_VISIBILITY_TIMEOUT_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_RETRY_DELAY_MS = 30_000

type EventQueueRow = {
  id: string
  topic: string
  payload: Prisma.JsonValue
  status: EventStatus
  attempts: number
  max_attempts: number | null
  dedupe_key: string | null
  available_at: Date
  locked_at: Date | null
  created_at: Date
  updated_at: Date
  last_error: string | null
}

export function createPrismaEventQueue(prismaClient = prisma): EventQueue {
  const mapRow = <P>(row: EventQueueRow): QueuedEvent<P> => ({
    id: row.id,
    topic: row.topic,
    payload: row.payload as P,
    attempts: row.attempts,
    availableAt: row.available_at,
    lockedAt: row.locked_at,
    lastError: row.last_error,
  })

  return {
    async enqueue<P = unknown>(events: EventMessage<P>[]): Promise<void> {
      if (!events.length) return

      await prismaClient.event_queue.createMany({
        data: events.map((event) => ({
          topic: event.topic,
          payload: event.payload as Prisma.InputJsonValue,
          available_at: event.scheduledFor ?? new Date(),
          dedupe_key: event.dedupeKey,
          max_attempts: event.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        })),
        skipDuplicates: true,
      })
    },

    async claim<P = unknown>(topic: string, options?: ClaimOptions): Promise<QueuedEvent<P>[]> {
      const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
      const visibilityTimeout = options?.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS

      if (batchSize <= 0) {
        return []
      }

      const rows = await prismaClient.$transaction(async (tx) => {
        const result = await tx.$queryRaw<EventQueueRow[]>`
          UPDATE event_queue
          SET status = 'PROCESSING',
              locked_at = NOW(),
              attempts = attempts + 1,
              available_at = NOW() + (${visibilityTimeout}::int * interval '1 millisecond')
          WHERE id IN (
            SELECT id
            FROM event_queue
            WHERE topic = ${topic}
              AND status IN ('PENDING', 'FAILED')
              AND available_at <= NOW()
              AND (max_attempts IS NULL OR attempts < max_attempts)
            ORDER BY available_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${batchSize}
          )
          RETURNING *;
        `
        return result
      })

      return rows.map((row) => mapRow<P>(row))
    },

    async markCompleted(ids: string[]): Promise<void> {
      if (!ids.length) return
      await prismaClient.event_queue.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'COMPLETED',
          locked_at: null,
          available_at: new Date(),
          last_error: null,
        },
      })
    },

    async markFailed(id: string, error: string, retryAt?: Date): Promise<void> {
      await prismaClient.$transaction(async (tx) => {
        const record = await tx.event_queue.findUnique({ where: { id } })
        if (!record) return

        const maxAttempts = record.max_attempts ?? DEFAULT_MAX_ATTEMPTS
        const hasAttemptsRemaining = record.attempts < maxAttempts

        await tx.event_queue.update({
          where: { id },
          data: {
            status: hasAttemptsRemaining ? 'PENDING' : 'FAILED',
            available_at: hasAttemptsRemaining ? (retryAt ?? new Date(Date.now() + DEFAULT_RETRY_DELAY_MS)) : record.available_at,
            locked_at: null,
            last_error: error,
          },
        })
      })
    },
  }
}

export const prismaEventQueue = createPrismaEventQueue()
