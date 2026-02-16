/**
 * Customer Thread Infrastructure Module
 *
 * Provides repository and service implementations for customer thread matching.
 */

import { prisma } from '@/lib/prisma'
import { createPrismaCustomerThreadRepository } from './PrismaCustomerThreadRepository'
import { createThreadDiscoveryService, type ThreadDiscoveryService } from './ThreadDiscoveryService'
import type { CustomerThreadRepository } from '@/lib/domain/customer-thread'

export { createPrismaCustomerThreadRepository } from './PrismaCustomerThreadRepository'
export { createThreadDiscoveryService, type ThreadDiscoveryService } from './ThreadDiscoveryService'

// Notification templates and service
export * from './TrackingNotificationTemplates'
export { 
  TrackingNotificationService, 
  getTrackingNotificationService,
  type ShipmentNotificationContext,
  type NotificationResult,
} from './TrackingNotificationService'

// Singleton instances
let customerThreadRepository: CustomerThreadRepository | null = null
let threadDiscoveryService: ThreadDiscoveryService | null = null

/**
 * Get the customer thread repository singleton.
 */
export function getCustomerThreadRepository(): CustomerThreadRepository {
  if (!customerThreadRepository) {
    customerThreadRepository = createPrismaCustomerThreadRepository(prisma)
  }
  return customerThreadRepository
}

/**
 * Get the thread discovery service singleton.
 * Requires Front client to be available.
 */
export async function getThreadDiscoveryService(): Promise<ThreadDiscoveryService> {
  if (!threadDiscoveryService) {
    // Lazy import Front client to avoid circular deps
    const { searchConversationsByEmail, searchConversationsByQuery } = await import('@/lib/infrastructure/sdks/front/client')

    const repository = getCustomerThreadRepository()

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

    threadDiscoveryService = createThreadDiscoveryService({
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
  return threadDiscoveryService
}

/**
 * Reset singletons (for testing).
 */
export function resetCustomerThreadServices(): void {
  customerThreadRepository = null
  threadDiscoveryService = null
}
