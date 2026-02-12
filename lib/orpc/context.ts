import { prisma } from '@/lib/prisma'
import { createRequestLogger } from '@/lib/infrastructure/logging/server-logger'
import type { ILogger } from '@/lib/infrastructure/logging/types'

const isDev = process.env.NODE_ENV === 'development'

export interface Context extends Record<string, unknown> {
  req: Request
  prisma: typeof prisma
  logger: ILogger
  requestId: string
}

export async function createContext(req: Request): Promise<Context> {
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

  // Only log in development
  if (isDev) {
    console.log(`📥 [${method}] ${url} [${requestId.substring(0, 8)}]`)
  }

  return {
    req,
    prisma,
    logger,
    requestId,
  }
}
