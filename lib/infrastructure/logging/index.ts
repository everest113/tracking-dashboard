/**
 * Universal logger factory
 * Automatically selects the right logger for the environment (server/client)
 */

import type { ILogger, LogContext, LoggerConfig } from './types'

export function getLogger(config: LoggerConfig = {}): ILogger {
  // Client-side
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const clientLogger = require('./client-logger').default
    return clientLogger
  }
  // Server-side
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getServerLogger } = require('./server-logger') as typeof import('./server-logger')
  return getServerLogger(config)
}

export function createLogger(context: LogContext, config?: LoggerConfig): ILogger {
  const logger = getLogger(config)
  return logger.child(context)
}

// Export types
export type { ILogger, LogContext, LogMetadata, LoggerConfig, LogLevel } from './types'

export function getRequestLogger(
  request: Request,
  additionalContext?: LogContext
): ILogger {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const url = new URL(request.url)
  const context: LogContext = {
    requestId,
    method: request.method,
    path: url.pathname,
    ...additionalContext,
  }
  return createLogger(context)
}

export function logPerformance(
  logger: ILogger,
  operation: string,
  metadata?: Record<string, unknown>
): () => void {
  const startTime = Date.now()
  logger.debug(`Starting: ${operation}`, metadata)
  return () => {
    const durationMs = Date.now() - startTime
    logger.info(`Completed: ${operation}`, {
      ...metadata,
      durationMs,
    })
  }
}

export function logError(
  logger: ILogger,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  logger.error(message, {
    error,
    ...context,
  })
}

export function logHttpResponse(
  logger: ILogger,
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
  logger[level](`${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    durationMs,
  })
}
