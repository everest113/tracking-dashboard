/**
 * Server-side logger implementation using Pino
 * Full-featured structured logging with OpenTelemetry compatibility
 * 
 * ONLY import this file in server-side code (API routes, server components, middleware)
 */

import pino from 'pino'
import type { ILogger, LogContext, LogMetadata, LoggerConfig, LogLevel } from './types'

class ServerLogger implements ILogger {
  private pino: pino.Logger
  private context: LogContext

  constructor(config: LoggerConfig = {}, context: LogContext = {}) {
    const {
      level = process.env.LOG_LEVEL || 'info',
      service = 'tracking-dashboard',
      environment = process.env.NODE_ENV || 'development',
      pretty = process.env.NODE_ENV === 'development',
      redact = ['password', 'token', 'apiKey', 'secret', 'authorization'],
    } = config

    this.context = {
      service,
      environment,
      ...context,
    }

    this.pino = pino({
      level,
      redact: {
        paths: redact,
        remove: true,
      },
      base: this.context,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label }
        },
      },
      serializers: {
        error: pino.stdSerializers.err,
      },
      // Pretty printing disabled due to worker thread issues
      // Use JSON output and pipe to pino-pretty externally if needed:
      // npm run dev | npx pino-pretty
    })
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata) {
    const { error, ...rest } = metadata || {}
    
    // If there's an error object, serialize it properly
    if (error) {
      this.pino[level](
        {
          err: error instanceof Error ? error : new Error(String(error)),
          ...rest,
        },
        message
      )
    } else {
      this.pino[level](rest, message)
    }
  }

  trace(message: string, metadata?: LogMetadata): void {
    this.log('trace', message, metadata)
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata)
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata)
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log('error', message, metadata)
  }

  fatal(message: string, metadata?: LogMetadata): void {
    this.log('fatal', message, metadata)
  }

  child(context: LogContext): ILogger {
    return new ServerLogger(
      {
        level: this.pino.level as LogLevel,
      },
      {
        ...this.context,
        ...context,
      }
    )
  }

  setLevel(level: LogLevel): void {
    this.pino.level = level
  }
}

/** Singleton server logger instance */
let serverLoggerInstance: ILogger | null = null

/**
 * Get or create the server logger
 * Call this in server-side code only
 */
export function getServerLogger(config?: LoggerConfig): ILogger {
  if (!serverLoggerInstance) {
    serverLoggerInstance = new ServerLogger(config)
  }
  return serverLoggerInstance
}

/**
 * Create a request-scoped logger with request context
 * Use this in API routes to get automatic request correlation
 */
export function createRequestLogger(context: LogContext): ILogger {
  return getServerLogger().child(context)
}
