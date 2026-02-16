/**
 * Unit tests for Audit Domain Types
 * Tests type definitions and constants
 */

import { describe, it, expect } from 'vitest'
import {
  AuditEntityTypes,
  AuditActions,
  AuditStatus,
  type AuditEntry,
  type CreateAuditEntryInput,
} from '@/lib/domain/audit/types'

describe('Audit Entity Types', () => {
  it('should have all expected entity types', () => {
    expect(AuditEntityTypes.Shipment).toBe('shipment')
    expect(AuditEntityTypes.Order).toBe('order')
    expect(AuditEntityTypes.CustomerThread).toBe('customer_thread')
    expect(AuditEntityTypes.Notification).toBe('notification')
    expect(AuditEntityTypes.Sync).toBe('sync')
  })

  it('should be a readonly const object', () => {
    // TypeScript enforces this at compile time,
    // but we can verify the values are strings
    Object.values(AuditEntityTypes).forEach((value) => {
      expect(typeof value).toBe('string')
    })
  })
})

describe('Audit Actions', () => {
  it('should have shipment-related actions', () => {
    expect(AuditActions.ShipmentCreated).toBe('shipment.created')
    expect(AuditActions.ShipmentStatusChanged).toBe('shipment.status_changed')
    expect(AuditActions.ShipmentDeleted).toBe('shipment.deleted')
  })

  it('should have thread-related actions', () => {
    expect(AuditActions.ThreadSearched).toBe('thread.searched')
    expect(AuditActions.ThreadAutoMatched).toBe('thread.auto_matched')
    expect(AuditActions.ThreadManuallyLinked).toBe('thread.manually_linked')
    expect(AuditActions.ThreadNoMatch).toBe('thread.no_match')
  })

  it('should have notification-related actions', () => {
    expect(AuditActions.NotificationSent).toBe('notification.sent')
    expect(AuditActions.NotificationFailed).toBe('notification.failed')
    expect(AuditActions.NotificationSkipped).toBe('notification.skipped')
  })

  it('should have sync-related actions', () => {
    expect(AuditActions.OmgSyncCompleted).toBe('omg.sync_completed')
    expect(AuditActions.OmgSyncFailed).toBe('omg.sync_failed')
    expect(AuditActions.FrontScanCompleted).toBe('front.scan_completed')
  })
})

describe('Audit Status', () => {
  it('should have all expected statuses', () => {
    expect(AuditStatus.Success).toBe('success')
    expect(AuditStatus.Failed).toBe('failed')
    expect(AuditStatus.Skipped).toBe('skipped')
    expect(AuditStatus.Pending).toBe('pending')
  })
})

describe('Type Contracts', () => {
  it('should allow creating a valid CreateAuditEntryInput', () => {
    const input: CreateAuditEntryInput = {
      entityType: 'shipment',
      entityId: '123',
      action: 'shipment.created',
      status: 'success',
    }

    expect(input.entityType).toBe('shipment')
    expect(input.entityId).toBe('123')
    expect(input.action).toBe('shipment.created')
    expect(input.status).toBe('success')
  })

  it('should allow optional fields in CreateAuditEntryInput', () => {
    const input: CreateAuditEntryInput = {
      entityType: 'shipment',
      entityId: '123',
      action: 'shipment.created',
      actor: 'user:456',
      metadata: { trackingNumber: '1Z999' },
      status: 'success',
      error: undefined,
    }

    expect(input.actor).toBe('user:456')
    expect(input.metadata).toEqual({ trackingNumber: '1Z999' })
  })

  it('should have correct AuditEntry structure', () => {
    const entry: AuditEntry = {
      id: 'cuid123',
      entityType: 'shipment',
      entityId: '123',
      action: 'notification.sent',
      actor: 'system',
      metadata: { conversationId: 'cnv_abc' },
      status: 'success',
      error: null,
      createdAt: new Date(),
    }

    expect(entry.id).toBe('cuid123')
    expect(entry.error).toBeNull()
    expect(entry.createdAt).toBeInstanceOf(Date)
  })
})
