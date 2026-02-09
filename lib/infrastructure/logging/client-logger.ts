/**
 * Client-side logger implementation
 * Lightweight browser-compatible logger for frontend code
 * 
 * Use this in client components, browser-side React hooks, etc.
 */

'use client'

import type { ILogger, LogContext, LogMetadata, LoggerConfig, LogLevel } from './types'

class ClientLogger implements ILogger {
  private level: LogLevel
  private context: LogContext
  private levels: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  }

  constructor(config: LoggerConfig = {}, context: LogContext = {}) {
    this.level = (config.level || 'info') as LogLevel
    this.context = {
      service: config.service || 'tracking-dashboard',
      environment: config.environment || process.env.NODE_ENV || 'development',
      ...context,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level]
  }

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): unknown[] {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      level,
      message,
      ...this.context,
      ...metadata,
    }

    // In development, return pretty format
    if (process.env.NODE_ENV === 'development') {
      const contextStr = Object.keys(this.context).length > 0 
        ? ` [${JSON.stringify(this.context)}]` 
        : ''
      return [`[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}`, metadata || {}]
    }

    // In production, return structured JSON
    return [logData]
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) return

    const formatted = this.formatMessage(level, message, metadata)

    // Use appropriate console method
    switch (level) {
      case 'trace':
      case 'debug':
        console.debug(...formatted)
        break
      case 'info':
        console.info(...formatted)
        break
      case 'warn':
        console.warn(...formatted)
        break
      case 'error':
      case 'fatal':
        console.error(...formatted)
        break
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

  child(additionalContext: LogContext): ILogger {
    return new ClientLogger({
      level: this.level,
    }, { ...this.context, ...additionalContext })
  }

  setLevel(newLevel: LogLevel): void {
    this.level = newLevel
  }
}

// Default instance
const logger = new ClientLogger({ level: 'info' }, { service: 'client' })

export default logger
