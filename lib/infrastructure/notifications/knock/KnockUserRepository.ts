import type {
  UserRepository,
  UserProperties,
  UserResult,
} from '@/lib/application/notifications/ports/UserRepository'
import { getKnockClient } from './KnockClient'

/**
 * Knock implementation of UserRepository.
 */
export function createKnockUserRepository(): UserRepository {
  return {
    async identify(userId: string, properties: UserProperties): Promise<UserResult> {
      const knock = getKnockClient()

      if (!knock) {
        console.log(`[knock] Skipping user identify (no API key): ${userId}`)
        return { success: true }
      }

      try {
        await knock.users.identify(userId, properties)
        console.log(`[knock] Identified user: ${userId}`)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to identify user: ${userId}`, { error: message })
        return { success: false, error: message }
      }
    },

    async delete(userId: string): Promise<UserResult> {
      const knock = getKnockClient()

      if (!knock) {
        return { success: true }
      }

      try {
        await knock.users.delete(userId)
        console.log(`[knock] Deleted user: ${userId}`)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to delete user: ${userId}`, { error: message })
        return { success: false, error: message }
      }
    },
  }
}
