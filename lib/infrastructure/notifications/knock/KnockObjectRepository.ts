import type {
  ObjectRepository,
  ObjectResult,
} from '@/lib/application/notifications/ports/ObjectRepository'
import { getKnockClient } from './KnockClient'

/**
 * Knock implementation of ObjectRepository.
 */
export function createKnockObjectRepository(): ObjectRepository {
  return {
    async upsert(
      collection: string,
      id: string,
      data: Record<string, unknown>
    ): Promise<ObjectResult> {
      const knock = getKnockClient()

      if (!knock) {
        console.log(`[knock] Skipping object upsert (no API key): ${collection}/${id}`)
        return { success: true }
      }

      try {
        await knock.objects.set(collection, id, data)
        console.log(`[knock] Upserted object: ${collection}/${id}`)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to upsert object: ${collection}/${id}`, { error: message })
        return { success: false, error: message }
      }
    },

    async delete(collection: string, id: string): Promise<ObjectResult> {
      const knock = getKnockClient()

      if (!knock) {
        return { success: true }
      }

      try {
        await knock.objects.delete(collection, id)
        console.log(`[knock] Deleted object: ${collection}/${id}`)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to delete object: ${collection}/${id}`, { error: message })
        return { success: false, error: message }
      }
    },

    async subscribe(
      collection: string,
      id: string,
      userIds: string[]
    ): Promise<ObjectResult> {
      const knock = getKnockClient()

      if (!knock) {
        console.log(`[knock] Skipping subscription (no API key): ${collection}/${id}`, { userIds })
        return { success: true }
      }

      if (userIds.length === 0) {
        return { success: true }
      }

      try {
        await knock.objects.addSubscriptions(collection, id, {
          recipients: userIds,
        })
        console.log(`[knock] Subscribed users to object: ${collection}/${id}`, { userIds })
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to subscribe users: ${collection}/${id}`, { error: message })
        return { success: false, error: message }
      }
    },

    async unsubscribe(
      collection: string,
      id: string,
      userIds: string[]
    ): Promise<ObjectResult> {
      const knock = getKnockClient()

      if (!knock) {
        return { success: true }
      }

      if (userIds.length === 0) {
        return { success: true }
      }

      try {
        await knock.objects.deleteSubscriptions(collection, id, {
          recipients: userIds,
        })
        console.log(`[knock] Unsubscribed users from object: ${collection}/${id}`, { userIds })
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to unsubscribe users: ${collection}/${id}`, { error: message })
        return { success: false, error: message }
      }
    },

    async getSubscribers(
      collection: string,
      id: string
    ): Promise<{ subscribers: string[]; error?: string }> {
      const knock = getKnockClient()

      if (!knock) {
        return { subscribers: [] }
      }

      try {
        const response = await knock.objects.listSubscriptions(collection, id)
        const subscribers = response.entries.map((sub) => sub.recipient.id)
        return { subscribers }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to get subscribers: ${collection}/${id}`, { error: message })
        return { subscribers: [], error: message }
      }
    },
  }
}
