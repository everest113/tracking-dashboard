'use client'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from './router'

/**
 * oRPC Client for browser-side API calls.
 * 
 * This client is designed for use in React components via useEffect or event handlers.
 * It should NOT be used during server-side rendering.
 */
function getBaseUrl(): string {
  // Client-side: use current origin (works regardless of port)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/orpc`
  }
  
  // Server-side with explicit URL configured
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/orpc`
  }
  
  // Fallback for build time
  return '/api/orpc'
}

const link = new RPCLink({
  url: getBaseUrl(),
})

export const api = createORPCClient<RouterClient<AppRouter>>(link)

// Re-export types for consumers
export type { AppRouter }
