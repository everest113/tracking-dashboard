import type { QueuedEvent } from './types'

type EventHandler = (event: QueuedEvent<unknown>) => Promise<void>

const handlers = new Map<string, EventHandler>()

export function registerEventHandler(topic: string, handler: EventHandler) {
  handlers.set(topic, handler)
}

export function getEventHandler(topic: string): EventHandler | undefined {
  return handlers.get(topic)
}

export function listTopics(): string[] {
  return Array.from(handlers.keys())
}
