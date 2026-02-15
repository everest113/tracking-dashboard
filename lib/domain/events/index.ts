/**
 * Domain Events System
 * 
 * A lightweight implementation of the Domain Events pattern from DDD.
 * Events are emitted when significant domain actions occur, and handlers
 * react to them - keeping side effects decoupled from the core logic.
 * 
 * Usage:
 *   // Emit an event
 *   domainEvents.emit('ShipmentPOLinked', { shipmentId: 123, poNumber: '102-01' })
 * 
 *   // Register a handler (typically at app startup)
 *   domainEvents.on('ShipmentPOLinked', async (payload) => { ... })
 */

type EventPayloads = {
  /** Emitted when a shipment is assigned/updated with a PO number */
  ShipmentPOLinked: {
    shipmentId: number
    poNumber: string
    previousPoNumber?: string | null
  }
  
  /** Emitted when a new shipment is created */
  ShipmentCreated: {
    shipmentId: number
    trackingNumber: string
    poNumber?: string | null
  }
  
  /** Emitted when a shipment's tracking status changes */
  ShipmentStatusChanged: {
    shipmentId: number
    oldStatus: string
    newStatus: string
  }
}

type EventName = keyof EventPayloads
type EventHandler<T extends EventName> = (payload: EventPayloads[T]) => Promise<void> | void

class DomainEventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers: Map<EventName, Set<EventHandler<any>>> = new Map()
  private asyncMode: boolean = true // Non-blocking by default

  /**
   * Register an event handler
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  /**
   * Emit a domain event
   * By default, handlers run asynchronously (non-blocking)
   */
  emit<T extends EventName>(event: T, payload: EventPayloads[T]): void {
    const eventHandlers = this.handlers.get(event)
    if (!eventHandlers || eventHandlers.size === 0) {
      return
    }

    console.log(`[DomainEvent] ${event}:`, JSON.stringify(payload))

    for (const handler of eventHandlers) {
      if (this.asyncMode) {
        // Non-blocking: don't await, just fire and forget
        Promise.resolve(handler(payload)).catch((err) => {
          console.error(`[DomainEvent] Handler error for ${event}:`, err)
        })
      } else {
        // Blocking mode (for testing)
        try {
          const result = handler(payload)
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`[DomainEvent] Handler error for ${event}:`, err)
            })
          }
        } catch (err) {
          console.error(`[DomainEvent] Handler error for ${event}:`, err)
        }
      }
    }
  }

  /**
   * Emit and wait for all handlers to complete
   * Use this when you need to ensure side effects complete before responding
   */
  async emitAndWait<T extends EventName>(event: T, payload: EventPayloads[T]): Promise<void> {
    const eventHandlers = this.handlers.get(event)
    if (!eventHandlers || eventHandlers.size === 0) {
      return
    }

    console.log(`[DomainEvent] ${event} (awaited):`, JSON.stringify(payload))

    const promises = Array.from(eventHandlers).map((handler) =>
      Promise.resolve(handler(payload)).catch((err) => {
        console.error(`[DomainEvent] Handler error for ${event}:`, err)
      })
    )

    await Promise.all(promises)
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear()
  }

  /**
   * Set async mode (for testing, you might want sync mode)
   */
  setAsyncMode(async: boolean): void {
    this.asyncMode = async
  }
}

// Singleton instance
export const domainEvents = new DomainEventEmitter()

// Re-export types for consumers
export type { EventPayloads, EventName }
