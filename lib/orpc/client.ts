'use client'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './router'

// Get the base URL dynamically - evaluated at request time, not module load time
function getBaseURL(): string {
  // Client-side: use current origin (works regardless of port)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/orpc`
  }
  
  // Server-side: require explicit configuration
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/orpc`
  }
  
  // Fallback for SSR - use relative URL (Next.js internal fetch can handle this)
  return '/api/orpc'
}

// Use a lazy URL getter so it's evaluated at request time
const link = new RPCLink({
  url: () => getBaseURL(),
})

export const api = createORPCClient<AppRouter>(link)
