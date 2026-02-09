/**
 * Application layer types
 * Shared types for use cases and services
 */

/**
 * Result of a tracking update operation
 */
export interface TrackingUpdateResult {
  success: boolean
  trackingNumber: string
  oldStatus: string
  newStatus: string
  statusChanged: boolean
  error?: string
}

/**
 * Result of tracker registration
 */
export interface TrackerRegistrationResult {
  success: boolean
  trackingNumber: string
  trackerId?: string
  error?: string
}

/**
 * Summary of batch operations
 */
export interface BatchOperationSummary {
  total: number
  successful: number
  failed: number
  errors: string[]
}

/**
 * Tracker registration result
 */
export interface TrackerRegistrationResult {
  success: boolean
  trackerId?: string
  error?: string
}
