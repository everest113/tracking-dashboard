import type { QueuedEvent } from './types'

type EventHandler = (event: QueuedEvent<unknown>) => Promise<void>

// Support multiple handlers per topic
const handlers = new Map<string, EventHandler[]>()

/**
 * Register an event handler for a topic.
 * Multiple handlers can be registered for the same topic.
 */
export function registerEventHandler(topic: string, handler: EventHandler) {
  const existing = handlers.get(topic) ?? []
  existing.push(handler)
  handlers.set(topic, existing)
}

/**
 * Get all handlers for a topic.
 * Returns a combined handler that runs all registered handlers.
 */
export function getEventHandler(topic: string): EventHandler | undefined {
  const topicHandlers = handlers.get(topic)
  if (!topicHandlers || topicHandlers.length === 0) {
    return undefined
  }
  
  // Return a combined handler that runs all handlers in parallel
  return async (event: QueuedEvent<unknown>) => {
    const results = await Promise.allSettled(
      topicHandlers.map(handler => handler(event))
    )
    
    // Log any failures but don't throw
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(`[Event Handler] Handler failed for ${topic}:`, result.reason)
      }
    }
  }
}

export function listTopics(): string[] {
  return Array.from(handlers.keys())
}
