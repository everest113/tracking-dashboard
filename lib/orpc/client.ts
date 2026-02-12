'use client'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './router'

/**
 * oRPC Client for browser-side API calls.
 * 
 * This client is designed for use in React components via useEffect or event handlers.
 * It should NOT be used during server-side rendering.
 * 
 * @see https://orpc.dev/docs/client/rpc-link#lazy-url
 */
const link = new RPCLink({
  // Lazy URL evaluation - called at request time, not module load time
  url: () => {
    // Client-side: use current origin (works regardless of port)
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/orpc`
    }
    
    // Server-side with explicit URL configured
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return `${process.env.NEXT_PUBLIC_APP_URL}/api/orpc`
    }
    
    // Server-side without config - this client shouldn't be used during SSR
    // All our API calls happen in useEffect/event handlers (client-only)
    throw new Error(
      'oRPC client cannot be used during server-side rendering. ' +
      'Ensure API calls are made in useEffect or event handlers, ' +
      'or set NEXT_PUBLIC_APP_URL for SSR support.'
    )
  },
})

export const api = createORPCClient<AppRouter>(link)

// Re-export types for consumers
export type { AppRouter }
