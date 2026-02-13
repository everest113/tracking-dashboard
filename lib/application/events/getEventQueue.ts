import { prismaEventQueue } from '@/lib/infrastructure/events/prisma-event-queue'
import type { EventQueue } from './EventQueue'

let eventQueue: EventQueue | null = null

export function getEventQueue(): EventQueue {
  if (!eventQueue) {
    eventQueue = prismaEventQueue
  }
  return eventQueue
}
