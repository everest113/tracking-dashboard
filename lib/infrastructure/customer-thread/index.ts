/**
 * Customer Thread Infrastructure Module
 *
 * Provides repository and service implementations for customer thread matching.
 * 
 * NOTE: Thread matching is now done at the ORDER level, not shipment level.
 * The old shipment-based APIs are deprecated.
 */

import { prisma } from '@/lib/prisma'
import { createOrderThreadRepository, type OrderThreadRepository } from './PrismaOrderThreadRepository'
import { createOrderThreadDiscoveryService, type OrderThreadDiscoveryService } from './OrderThreadDiscoveryService'

// New order-based exports
export { createOrderThreadRepository, type OrderThreadRepository } from './PrismaOrderThreadRepository'
export { createOrderThreadDiscoveryService, type OrderThreadDiscoveryService } from './OrderThreadDiscoveryService'

// Notification templates and service
export * from './TrackingNotificationTemplates'
export { 
  TrackingNotificationService, 
  getTrackingNotificationService,
  type ShipmentNotificationContext,
  type NotificationResult,
} from './TrackingNotificationService'

// Singleton instances
let orderThreadRepository: OrderThreadRepository | null = null
let orderThreadDiscoveryService: OrderThreadDiscoveryService | null = null

/**
 * Get the order thread repository singleton.
 */
export function getOrderThreadRepository(): OrderThreadRepository {
  if (!orderThreadRepository) {
    orderThreadRepository = createOrderThreadRepository(prisma)
  }
  return orderThreadRepository
}

/**
 * Get the order thread discovery service singleton.
 */
export async function getOrderThreadDiscoveryService(): Promise<OrderThreadDiscoveryService> {
  if (!orderThreadDiscoveryService) {
    // Lazy import Front client to avoid circular deps
    const { searchConversationsByEmail, searchConversationsByQuery } = await import('@/lib/infrastructure/sdks/front/client')

    const repository = getOrderThreadRepository()

    // Helper to map Front conversation to our format
    const mapConversation = (conv: Awaited<ReturnType<typeof searchConversationsByEmail>>[0], fallbackEmail?: string) => ({
      id: conv.id,
      subject: conv.subject ?? null,
      // created_at is Unix timestamp (seconds) - convert to Date string
      lastMessageAt: conv.created_at ? new Date(conv.created_at * 1000).toISOString() : null,
      // Single recipient from conversation
      recipients: conv.recipient 
        ? [{ handle: conv.recipient.handle }]
        : fallbackEmail ? [{ handle: fallbackEmail }] : [],
    })

    orderThreadDiscoveryService = createOrderThreadDiscoveryService({
      repository,
      frontClient: {
        async searchConversationsByEmail(email: string) {
          const results = await searchConversationsByEmail(email)
          return results.map((conv) => mapConversation(conv, email))
        },
        async searchConversationsByQuery(query: string) {
          const results = await searchConversationsByQuery(query)
          return results.map((conv) => mapConversation(conv))
        },
      },
    })
  }
  return orderThreadDiscoveryService
}

/**
 * Reset singletons (for testing).
 */
export function resetCustomerThreadServices(): void {
  orderThreadRepository = null
  orderThreadDiscoveryService = null
}

// =============================================================================
// DEPRECATED: Shipment-based APIs (kept for backwards compatibility during migration)
// =============================================================================

/** @deprecated Use getOrderThreadRepository instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCustomerThreadRepository(): any {
  console.warn('getCustomerThreadRepository is deprecated. Use getOrderThreadRepository instead.')
  return getOrderThreadRepository()
}

/** @deprecated Use getOrderThreadDiscoveryService instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getThreadDiscoveryService(): Promise<any> {
  console.warn('getThreadDiscoveryService is deprecated. Use getOrderThreadDiscoveryService instead.')
  return getOrderThreadDiscoveryService()
}
