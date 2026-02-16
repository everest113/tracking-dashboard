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
    const { searchConversationsByEmail } = await import('@/lib/infrastructure/sdks/front/client')

    const repository = getCustomerThreadRepository()

    threadDiscoveryService = createThreadDiscoveryService({
      repository,
      frontClient: {
        async searchConversations(email: string) {
          const results = await searchConversationsByEmail(email)
          return results.map((conv) => ({
            id: conv.id,
            subject: conv.subject ?? null,
            lastMessageAt: conv.last_message?.created_at ?? null,
            recipients: conv.recipients?.map((r) => ({ handle: r.handle })) ?? [],
          }))
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
