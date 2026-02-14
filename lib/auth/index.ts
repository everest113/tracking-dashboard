import { auth0 } from '@/lib/auth0'
import { cache } from 'react'

/**
 * Get the current user session (server-side).
 * Cached per request to avoid multiple Auth0 calls.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth0.getSession()
  return session?.user ?? null
})

/**
 * Require authentication (server-side).
 * Throws if user is not authenticated.
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Get the user ID for use with external services (Knock, etc.).
 * Uses Auth0's `sub` claim as the unique identifier.
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.sub ?? null
}
