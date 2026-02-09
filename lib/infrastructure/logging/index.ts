/**
 * Universal logger factory
 * Automatically selects the right logger for the environment (server/client)
 */

import type { ILogger, LogContext, LoggerConfig, LogLevel } from './types'

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

// Console fallback logger (implements full ILogger interface)
function createConsoleLogger(): ILogger {
  let minLevel: LogLevel = 'debug'
  
  const levelValues: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  }
  
  const shouldLog = (level: LogLevel): boolean => {
    return levelValues[level] >= levelValues[minLevel]
  }
  
  const log = (level: LogLevel, message: string, metadata?: unknown) => {
    if (!shouldLog(level)) return
    
    const meta = metadata ? ` ${JSON.stringify(metadata)}` : ''
    const logMessage = `[${level.toUpperCase()}] ${message}${meta}`
    
    switch (level) {
      case 'trace':
      case 'debug':
        console.debug(logMessage)
        break
      case 'info':
        console.info(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'error':
      case 'fatal':
        console.error(logMessage)
        break
    }
  }

  return {
    trace: (msg, meta) => log('trace', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    fatal: (msg, meta) => log('fatal', msg, meta),
    child: () => createConsoleLogger(),
    setLevel: (level: LogLevel) => {
      minLevel = level
    },
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
