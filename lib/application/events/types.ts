export interface EventMessage<P = unknown> {
  topic: string
  payload: P
  /** Schedule the event to become available in the future */
  scheduledFor?: Date
  /** Optional deduplication key (unique constraint enforced in DB) */
  dedupeKey?: string
  /** Override default max attempts */
  maxAttempts?: number
  metadata?: Record<string, unknown>
}

export interface QueuedEvent<P = unknown> extends EventMessage<P> {
  id: string
  attempts: number
  availableAt: Date
  lockedAt: Date | null
  lastError?: string | null
}

export interface ClaimOptions {
  batchSize?: number
  /** How long a worker owns a message before it becomes visible again. */
  visibilityTimeoutMs?: number
}
