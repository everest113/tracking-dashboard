/**
 * Universal logger factory
 * Automatically selects the right logger for the environment (server/client)
 */

import type { ILogger, LogContext, LoggerConfig } from './types'

let cachedLogger: ILogger | null = null

export function getLogger(config: LoggerConfig = {}): ILogger {
  if (cachedLogger) return cachedLogger
  
  // Client-side
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: clientLogger } = require('./client-logger')
    cachedLogger = clientLogger
    return clientLogger
  }
  
  // Server-side
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serverLoggerModule = require('./server-logger')
    const serverLogger = serverLoggerModule.getServerLogger(config)
    cachedLogger = serverLogger
    return serverLogger
  } catch (error) {
    // Fallback to console if server logger fails to load
    console.warn('Failed to load server logger, using console fallback:', error)
    return createConsoleLogger()
  }
}

// Console fallback logger
function createConsoleLogger(): ILogger {
  const log = (level: string, message: string, metadata?: unknown) => {
    const meta = metadata ? ` ${JSON.stringify(metadata)}` : ''
    console[level as keyof Console]?.(`[${level.toUpperCase()}] ${message}${meta}`)
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    child: () => createConsoleLogger(),
  }
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
