/**
 * API Response Schemas
 * Zod schemas for all internal API endpoints
 * Use these in components for type-safe API consumption
 */

import { z } from 'zod'

/**
 * Shipment response schema
 */
export const ShipmentSchema = z.object({
  id: z.number(),
  trackingNumber: z.string(),
  carrier: z.string().nullable(),
  status: z.string(),
  poNumber: z.string().nullable(),
  supplier: z.string().nullable(),
  ship24TrackerId: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  shippedDate: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  deliveredDate: z.string().nullable(),
  lastChecked: z.string().nullable(),
  frontConversationId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Shipment = z.infer<typeof ShipmentSchema>

/**
 * Tracking stats response schema
 */
export const TrackingStatsSchema = z.object({
  totalShipments: z.number(),
  byStatus: z.record(z.string(), z.number()),
  recentlyUpdated: z.number(),
  needingUpdate: z.number(),
})

export type TrackingStats = z.infer<typeof TrackingStatsSchema>

/**
 * Sync summary schema
 */
export const SyncSummarySchema = z.object({
  conversationsProcessed: z.number(),
  conversationsAlreadyScanned: z.number(),
  shipmentsAdded: z.number(),
  shipmentsSkipped: z.number(),
  conversationsWithNoTracking: z.number(),
  batchSize: z.number(),
  limit: z.number().optional(),
})

export type SyncSummary = z.infer<typeof SyncSummarySchema>

/**
 * Scan result schema
 */
export const ScanResultSchema = z.object({
  success: z.boolean(),
  summary: SyncSummarySchema,
  errors: z.array(z.string()).optional(),
  durationMs: z.number().optional(),
  timestamp: z.string().optional(),
})

export type ScanResult = z.infer<typeof ScanResultSchema>

/**
 * Sync history schema
 */
export const SyncHistorySchema = z.object({
  id: z.number(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  conversations_processed: z.number(),
  shipments_added: z.number(),
  shipments_skipped: z.number(),
  errors: z.array(z.string()),
  status: z.string(),
  duration_ms: z.number().nullable(),
})

export type SyncHistory = z.infer<typeof SyncHistorySchema>

/**
 * Tracking update result schema
 */
export const TrackingUpdateResultSchema = z.object({
  success: z.boolean(),
  checked: z.number(),
  updated: z.number(),
  delivered: z.number().optional(),
  errors: z.number(),
  errorMessages: z.array(z.string()).optional(),
  durationMs: z.number(),
  timestamp: z.string(),
})

export type TrackingUpdateResult = z.infer<typeof TrackingUpdateResultSchema>

/**
 * Tracker registration result schema
 */
export const TrackerRegistrationResultSchema = z.object({
  success: z.boolean(),
  registered: z.number(),
  skipped: z.number(),
  errors: z.number(),
  total: z.number(),
  errorMessages: z.array(z.string()).optional(),
  durationMs: z.number(),
  timestamp: z.string(),
})

export type TrackerRegistrationResult = z.infer<typeof TrackerRegistrationResultSchema>

/**
 * Generic API error schema
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  timestamp: z.string().optional(),
})

export type ApiError = z.infer<typeof ApiErrorSchema>
