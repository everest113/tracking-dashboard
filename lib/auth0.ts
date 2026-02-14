import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { syncUserToKnock } from './auth/knock-sync'

/**
 * Auth0 client instance.
 * 
 * Used for all server-side authentication operations.
 */
export const auth0 = new Auth0Client({
  // Hook to sync user to Knock before session is saved
  async beforeSessionSaved(session) {
    if (session?.user) {
      // Sync user to Knock for notifications (fire and forget)
      syncUserToKnock(session.user).catch((err) => {
        console.error('[auth0] Failed to sync user to Knock:', err)
      })
    }
    return session
  }
})
