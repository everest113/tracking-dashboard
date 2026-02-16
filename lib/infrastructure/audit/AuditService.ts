/**
 * Audit Service
 * 
 * Application service providing a clean API for audit logging.
 * Wraps the repository with convenience methods and handles
 * common patterns like idempotency checks.
 */

import type {
  AuditRepository,
  AuditEntry,
  AuditAction,
  AuditEntityType,
  AuditStatusType,
  AuditHistoryQuery,
} from '@/lib/domain/audit'

export interface AuditService {
  /**
   * Record an audit entry.
   */
  record(params: {
    entityType: AuditEntityType
    entityId: string
    action: AuditAction
    actor?: string
    metadata?: Record<string, unknown>
    status: AuditStatusType
    error?: string
  }): Promise<AuditEntry>

  /**
   * Record a successful action.
   * Convenience method that sets status to 'success'.
   */
  recordSuccess(params: {
    entityType: AuditEntityType
    entityId: string
    action: AuditAction
    actor?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditEntry>

  /**
   * Record a failed action.
   * Convenience method that sets status to 'failed'.
   */
  recordFailure(params: {
    entityType: AuditEntityType
    entityId: string
    action: AuditAction
    error: string
    actor?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditEntry>

  /**
   * Record a skipped action.
   * Convenience method that sets status to 'skipped'.
   */
  recordSkipped(params: {
    entityType: AuditEntityType
    entityId: string
    action: AuditAction
    reason?: string
    actor?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditEntry>

  /**
   * Get audit history for an entity.
   */
  getHistory(
    entityType: AuditEntityType,
    entityId: string,
    options?: { action?: AuditAction; limit?: number; offset?: number }
  ): Promise<AuditEntry[]>

  /**
   * Check if a specific action has been performed successfully.
   * Useful for idempotency checks.
   */
  hasSuccessfulAction(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction
  ): Promise<boolean>

  /**
   * Check if any action matching criteria exists.
   */
  hasAction(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    status?: AuditStatusType
  ): Promise<boolean>

  /**
   * Get the most recent entry for an entity.
   */
  getLatest(
    entityType: AuditEntityType,
    entityId: string,
    action?: AuditAction
  ): Promise<AuditEntry | null>

  /**
   * Count entries for an entity.
   */
  countEntries(query: Omit<AuditHistoryQuery, 'limit' | 'offset'>): Promise<number>
}

/**
 * Create an AuditService instance.
 */
export function createAuditService(repository: AuditRepository): AuditService {
  return {
    async record(params) {
      return repository.create({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actor: params.actor,
        metadata: params.metadata,
        status: params.status,
        error: params.error,
      })
    },

    async recordSuccess(params) {
      return repository.create({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actor: params.actor,
        metadata: params.metadata,
        status: 'success',
      })
    },

    async recordFailure(params) {
      return repository.create({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actor: params.actor,
        metadata: params.metadata,
        status: 'failed',
        error: params.error,
      })
    },

    async recordSkipped(params) {
      return repository.create({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actor: params.actor,
        metadata: {
          ...params.metadata,
          ...(params.reason && { skipReason: params.reason }),
        },
        status: 'skipped',
      })
    },

    async getHistory(entityType, entityId, options) {
      return repository.getHistory({
        entityType,
        entityId,
        action: options?.action,
        limit: options?.limit,
        offset: options?.offset,
      })
    },

    async hasSuccessfulAction(entityType, entityId, action) {
      return repository.hasAction({
        entityType,
        entityId,
        action,
        status: 'success',
      })
    },

    async hasAction(entityType, entityId, action, status) {
      return repository.hasAction({
        entityType,
        entityId,
        action,
        status,
      })
    },

    async getLatest(entityType, entityId, action) {
      return repository.getLatest(entityType, entityId, action)
    },

    async countEntries(query) {
      return repository.count(query)
    },
  }
}
