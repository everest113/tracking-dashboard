import { PrismaEventQueue } from '@/lib/infrastructure/events/prisma-event-queue'
import type { EventQueue } from './EventQueue'

let eventQueue: EventQueue | null = null

export function getEventQueue(): EventQueue {
  if (!eventQueue) {
    eventQueue = new PrismaEventQueue()
  }
  return eventQueue
}
