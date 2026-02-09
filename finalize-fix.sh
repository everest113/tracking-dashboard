#!/bin/bash

# Create comprehensive type file for all response types
cat > lib/types/component-types.ts << 'EOF'
export interface ShipmentResponse {
  id: number
  trackingNumber: string
  carrier: string | null
  status: string
  poNumber: string | null
  supplier: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncHistoryResponse {
  id: number
  started_at: string
  completed_at: string | null
  conversations_processed: number
  shipments_added: number
}
EOF

# Add missing type exports
echo "export * from './component-types'" >> lib/types/index.ts

# Fix require imports in logging with proper ESLint disable
cat > lib/infrastructure/logging/index.ts << 'LOGEOF'
/**
 * Universal logger factory
 */

import type { ILogger, LogContext, LoggerConfig } from './types'

export type { ILogger, LogContext, LogMetadata, LoggerConfig, LogLevel } from './types'

export function getLogger(config?: LoggerConfig): ILogger {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getClientLogger } = require('./client-logger') as typeof import('./client-logger')
    return getClientLogger(config)
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getServerLogger } = require('./server-logger') as typeof import('./server-logger')
  return getServerLogger(config)
}

export function createLogger(context: LogContext, config?: LoggerConfig): ILogger {
  return getLogger(config).child(context)
}

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
  logger.debug(\`Starting: \${operation}\`, metadata)
  return () => {
    const durationMs = Date.now() - startTime
    logger.info(\`Completed: \${operation}\`, {
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
  logger[level](\`\${method} \${path} \${statusCode}\`, {
    method,
    path,
    statusCode,
    durationMs,
  })
}
LOGEOF

# Fix logger unused params
sed -i '' 's/trace(message: string, metadata?: LogMetadata)/trace(message: string, _metadata?: LogMetadata)/g' lib/infrastructure/logging/client-logger.ts

echo "Done!"
