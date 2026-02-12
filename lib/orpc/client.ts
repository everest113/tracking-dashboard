'use client'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './router'

// Get the base URL - must be absolute URL for fetch
function getBaseURL() {
  // Always use window.location.origin when available (works for both client and SSR)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/orpc`
  }
  // Server-side fallback: use localhost with common dev port
  // In production, set NEXT_PUBLIC_APP_URL
  return process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/orpc`
    : 'http://localhost:3001/api/orpc'
}

const link = new RPCLink({
  url: getBaseURL(),
})

export const api = createORPCClient<AppRouter>(link)
