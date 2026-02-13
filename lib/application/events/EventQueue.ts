import type { ClaimOptions, EventMessage, QueuedEvent } from './types'

export interface EventQueue {
  enqueue<P = unknown>(events: EventMessage<P>[]): Promise<void>
  claim<P = unknown>(topic: string, options?: ClaimOptions): Promise<QueuedEvent<P>[]>
  markCompleted(ids: string[]): Promise<void>
  markFailed(id: string, error: string, retryAt?: Date): Promise<void>
}
