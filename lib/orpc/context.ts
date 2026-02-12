import { prisma } from '@/lib/prisma'
import { createRequestLogger } from '@/lib/infrastructure/logging/server-logger'
import type { ILogger } from '@/lib/infrastructure/logging/types'

/**
 * Enable verbose request logging.
 * Set DEBUG_ORPC=true in .env.local to enable.
 */
const DEBUG_ORPC = process.env.DEBUG_ORPC === 'true'

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

  if (DEBUG_ORPC) {
    console.log(`📥 [${method}] ${url} [${requestId.substring(0, 8)}]`)
  }

  return {
    req,
    prisma,
    logger,
    requestId,
  }
}
