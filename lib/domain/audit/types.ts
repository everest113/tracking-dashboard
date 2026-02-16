/**
 * Domain types for Audit History.
 * 
 * The audit system follows the W3C Activity Streams model:
 * - Actor: Who performed the action
 * - Action: What was done
 * - Entity: What was acted upon
 * 
 * This is a generic, entity-agnostic audit log that can track
 * actions on any domain entity (shipments, orders, threads, etc.)
 */

/**
 * Known entity types in the system.
 * Extensible - add new types as needed.
 */
export const AuditEntityTypes = {
  Shipment: 'shipment',
  Order: 'order',
  CustomerThread: 'customer_thread',
  Notification: 'notification',
  Sync: 'sync',
} as const

export type AuditEntityType = typeof AuditEntityTypes[keyof typeof AuditEntityTypes] | string

/**
 * Known actions in the system.
 * Extensible - add new actions as needed.
 */
export const AuditActions = {
  // Shipment actions
  ShipmentCreated: 'shipment.created',
  ShipmentStatusChanged: 'shipment.status_changed',
  ShipmentDeleted: 'shipment.deleted',
  
  // Customer thread actions
  ThreadSearched: 'thread.searched',
  ThreadAutoMatched: 'thread.auto_matched',
  ThreadManuallyLinked: 'thread.manually_linked',
  ThreadNoMatch: 'thread.no_match',
  
  // Notification actions
  NotificationSent: 'notification.sent',
  NotificationFailed: 'notification.failed',
  NotificationSkipped: 'notification.skipped',
  
  // Sync actions
  OmgSyncCompleted: 'omg.sync_completed',
  OmgSyncFailed: 'omg.sync_failed',
  FrontScanCompleted: 'front.scan_completed',
} as const

export type AuditAction = typeof AuditActions[keyof typeof AuditActions] | string

/**
 * Audit status values.
 */
export const AuditStatus = {
  Success: 'success',
  Failed: 'failed',
  Skipped: 'skipped',
  Pending: 'pending',
} as const

export type AuditStatusType = typeof AuditStatus[keyof typeof AuditStatus]

/**
 * Input for creating an audit entry.
 */
export interface CreateAuditEntryInput {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actor?: string
  metadata?: Record<string, unknown>
  status: AuditStatusType
  error?: string
}

/**
 * A recorded audit entry.
 */
export interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actor: string
  metadata: Record<string, unknown>
  status: string
  error: string | null
  createdAt: Date
}

/**
 * Query options for fetching audit history.
 */
export interface AuditHistoryQuery {
  entityType: string
  entityId: string
  action?: string
  limit?: number
  offset?: number
}

/**
 * Check if a specific action exists for an entity.
 */
export interface HasActionQuery {
  entityType: string
  entityId: string
  action: string
  status?: AuditStatusType
}
