/**
 * Next.js middleware for automatic request logging
 * Use in API routes to get automatic request/response logging with timing
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRequestLogger, logHttpResponse } from './index'

/**
 * Wrap a Next.js API route handler with automatic logging
 * 
 * Usage in route.ts:
 * ```typescript
 * import { withLogging } from '@/lib/infrastructure/logging/middleware'
 * 
 * export const GET = withLogging(async (request, { logger }) => {
 *   logger.info('Processing request')
 *   // ... your logic
 *   return NextResponse.json({ data })
 * })
 * ```
 */
export function withLogging<T = unknown>(
  handler: (
    request: NextRequest,
    context: { logger: ReturnType<typeof getRequestLogger> }
  ) => Promise<NextResponse<T> | Response>
) {
  return async (request: NextRequest): Promise<NextResponse<T> | Response> => {
    const startTime = Date.now()
    const logger = getRequestLogger(request)
    
    try {
      // Log incoming request
      logger.debug('Incoming request', {
        method: request.method,
        path: new URL(request.url).pathname,
        userAgent: request.headers.get('user-agent'),
      })

      // Execute handler with logger in context
      const response = await handler(request, { logger })

      // Log response
      const durationMs = Date.now() - startTime
      logHttpResponse(
        logger,
        request.method,
        new URL(request.url).pathname,
        response.status,
        durationMs
      )

      return response
    } catch (error) {
      // Log error
      const durationMs = Date.now() - startTime
      logger.error('Request failed', {
        error,
        method: request.method,
        path: new URL(request.url).pathname,
        durationMs,
      })

      // Re-throw to let Next.js error handling take over
      throw error
    }
  }
}

/**
 * Create a tRPC/ORPC context with logger
 * Use this with your ORPC setup
 */
export function createLoggerContext(request: NextRequest) {
  return {
    logger: getRequestLogger(request),
  }
}
