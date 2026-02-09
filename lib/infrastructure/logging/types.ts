/**
 * Core logging types - environment agnostic
 * Can be used on client and server
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = {
  /** Request ID for tracing across services */
  requestId?: string
  /** User ID if authenticated */
  userId?: string
  /** Correlation ID for distributed tracing */
  correlationId?: string
  /** Service name */
  service?: string
  /** Environment (dev, staging, production) */
  environment?: string
  /** Additional metadata */
  [key: string]: unknown
}

export type LogMetadata = {
  /** Error object if logging an error */
  error?: Error | unknown
  /** Duration in milliseconds for performance logging */
  durationMs?: number
  /** HTTP status code */
  statusCode?: number
  /** HTTP method */
  method?: string
  /** Request path */
  path?: string
  /** Additional structured data */
  [key: string]: unknown
}

export interface ILogger {
  /** Log at trace level (most verbose) */
  trace(message: string, metadata?: LogMetadata): void
  
  /** Log at debug level */
  debug(message: string, metadata?: LogMetadata): void
  
  /** Log at info level (default) */
  info(message: string, metadata?: LogMetadata): void
  
  /** Log at warn level */
  warn(message: string, metadata?: LogMetadata): void
  
  /** Log at error level */
  error(message: string, metadata?: LogMetadata): void
  
  /** Log at fatal level (most severe) */
  fatal(message: string, metadata?: LogMetadata): void
  
  /** Create a child logger with additional context */
  child(context: LogContext): ILogger
  
  /** Set the minimum log level */
  setLevel(level: LogLevel): void
}

/** Configuration for logger initialization */
export type LoggerConfig = {
  /** Minimum log level to output */
  level?: LogLevel
  /** Service name */
  service?: string
  /** Environment */
  environment?: string
  /** Enable pretty printing (development) */
  pretty?: boolean
  /** Redact sensitive fields */
  redact?: string[]
  /** OpenTelemetry endpoint (optional) */
  otlpEndpoint?: string
}
