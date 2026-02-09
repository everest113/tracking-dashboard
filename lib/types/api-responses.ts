/**
 * Common API response types
 */

export interface ApiErrorResponse {
  error: string
  details?: string
  timestamp?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp?: string
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | { success: false; error: string }

/**
 * Sync/Scan result types
 */
export interface SyncSummary {
  conversationsProcessed: number
  conversationsAlreadyScanned: number
  shipmentsAdded: number
  shipmentsSkipped: number
  conversationsWithNoTracking: number
  batchSize: number
  limit?: number
}

export interface ScanResult {
  success: boolean
  summary: SyncSummary
  errors?: string[]
  durationMs?: number
  timestamp?: string
}

/**
 * Tracking stats types
 */
export interface TrackingStats {
  totalShipments: number
  byStatus: Record<string, number>
  recentlyUpdated: number
  needingUpdate: number
}

/**
 * Generic error with message
 */
export interface ErrorWithMessage {
  message: string
  stack?: string
}

/**
 * Type guard for errors
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) return error.message
  if (typeof error === 'string') return error
  return 'An unknown error occurred'
}

/**
 * Get error stack safely
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isErrorWithMessage(error)) return error.stack
  return undefined
}
