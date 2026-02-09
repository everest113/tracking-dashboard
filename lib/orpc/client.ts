'use client'

import { createORPCClient } from '@orpc/client'
import { ORPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './router'

const baseURL = typeof window !== 'undefined' ? '/api/orpc' : 'http://localhost:3000/api/orpc'

const link = new ORPCLink({
  url: baseURL,
})

export const api = createORPCClient<AppRouter>(link)
