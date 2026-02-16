/**
 * Audit Repository Interface (Port)
 * 
 * Defines the contract for audit history persistence.
 * Infrastructure layer provides the implementation.
 */

import type {
  AuditEntry,
  AuditHistoryQuery,
  CreateAuditEntryInput,
  HasActionQuery,
} from './types'

export interface AuditRepository {
  /**
   * Create a new audit entry.
   * This is append-only - entries are never updated or deleted.
   */
  create(input: CreateAuditEntryInput): Promise<AuditEntry>

  /**
   * Create multiple audit entries in a single transaction.
   */
  createMany(inputs: CreateAuditEntryInput[]): Promise<AuditEntry[]>

  /**
   * Get audit history for an entity.
   * Returns entries in reverse chronological order (newest first).
   */
  getHistory(query: AuditHistoryQuery): Promise<AuditEntry[]>

  /**
   * Check if a specific action exists for an entity.
   * Useful for idempotency checks (e.g., "has notification already been sent?")
   */
  hasAction(query: HasActionQuery): Promise<boolean>

  /**
   * Get the most recent entry for an entity and action.
   * Returns null if no matching entry exists.
   */
  getLatest(entityType: string, entityId: string, action?: string): Promise<AuditEntry | null>

  /**
   * Count entries matching criteria.
   */
  count(query: Omit<AuditHistoryQuery, 'limit' | 'offset'>): Promise<number>
}
