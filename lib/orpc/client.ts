'use client'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './router'

// Get the base URL - must be absolute URL for fetch
function getBaseURL() {
  if (typeof window !== 'undefined') {
    // Client-side: use relative path or construct from window.location
    return `${window.location.origin}/api/orpc`
  }
  // Server-side
  return process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/orpc`
    : 'http://localhost:3000/api/orpc'
}

const link = new RPCLink({
  url: getBaseURL(),
})

export const api = createORPCClient<AppRouter>(link)
