import { prisma } from '@/lib/prisma'
import { createRequestLogger } from '@/lib/infrastructure/logging/server-logger'
import type { ILogger } from '@/lib/infrastructure/logging/types'

export interface Context extends Record<string, unknown> {
  req: Request
  prisma: typeof prisma
  logger: ILogger
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

  // Console log for dev visibility
  console.log(`📥 [${method}] ${url} [${requestId.substring(0, 8)}]`)

  return {
    req,
    prisma,
    logger,
  }
}
