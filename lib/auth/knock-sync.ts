import { getUserRepository } from '@/lib/infrastructure/notifications/knock'

interface Auth0User {
  sub?: string
  email?: string
  name?: string
  picture?: string
  [key: string]: unknown
}

/**
 * Sync an Auth0 user to Knock.
 * 
 * Call this after successful authentication to ensure the user
 * exists in Knock and can receive notifications.
 */
export async function syncUserToKnock(user: Auth0User): Promise<void> {
  const userRepo = getUserRepository()
  
  // Use Auth0's `sub` claim as the user ID
  const userId = user.sub
  if (!userId) {
    console.warn('[knock-sync] User has no sub claim, skipping sync')
    return
  }

  const result = await userRepo.identify(userId, {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    avatar: user.picture ?? undefined,
    // Add any custom properties you want to track
    // These can be used in notification templates
  })

  if (!result.success) {
    console.error('[knock-sync] Failed to sync user to Knock:', result.error)
  }
}
