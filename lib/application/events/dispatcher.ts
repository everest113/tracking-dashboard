import { getEventQueue } from './getEventQueue'
import { getEventHandler } from './registry'
import type { ClaimOptions } from './types'

const DEFAULT_BATCH_SIZE = 25

export async function dispatchEvents(topic: string, options?: ClaimOptions) {
  const queue = getEventQueue()
  const handler = getEventHandler(topic)
  if (!handler) {
    return { processed: 0, skipped: 0, errors: 0 }
  }

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const events = await queue.claim(topic, { ...options, batchSize })
  let processed = 0
  let errors = 0

  for (const event of events) {
    try {
      await handler(event)
      await queue.markCompleted([event.id])
      processed++
    } catch (error) {
      errors++
      const message = error instanceof Error ? error.message : JSON.stringify(error)
      await queue.markFailed(event.id, message)
    }
  }

  return { processed, skipped: events.length - processed, errors }
}
