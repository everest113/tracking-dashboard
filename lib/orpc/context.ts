import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRequestLogger } from '@/lib/infrastructure/logging/server-logger'
import type { ILogger } from '@/lib/infrastructure/logging/types'

export interface Context extends Record<string, unknown> {
  req: NextRequest
  prisma: typeof prisma
  logger: ILogger
}

export async function createContext(req: NextRequest): Promise<Context> {
  // Extract request metadata for logging
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
  const method = req.method
  const url = req.url
  const userAgent = req.headers.get('user-agent') || 'unknown'

  // Create request-scoped logger with context
  const logger = createRequestLogger({
    requestId,
    method,
    url,
    userAgent,
  })

  return {
    req,
    prisma,
    logger,
  }
}
