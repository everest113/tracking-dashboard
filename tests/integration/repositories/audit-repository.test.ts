/**
 * Integration tests for Audit Repository
 * Tests the Prisma implementation against a real database.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createPrismaAuditRepository } from '@/lib/infrastructure/audit/PrismaAuditRepository'
import { AuditEntityTypes, AuditActions, AuditStatus } from '@/lib/domain/audit'

describe('PrismaAuditRepository', () => {
  const repository = createPrismaAuditRepository(prisma)

  // Clean audit_history before each test
  beforeEach(async () => {
    await prisma.audit_history.deleteMany()
  })

  describe('create', () => {
    it('should create an audit entry with required fields', async () => {
      const entry = await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId: '123',
        action: AuditActions.ShipmentCreated,
        status: AuditStatus.Success,
      })

      expect(entry.id).toBeDefined()
      expect(entry.entityType).toBe('shipment')
      expect(entry.entityId).toBe('123')
      expect(entry.action).toBe('shipment.created')
      expect(entry.actor).toBe('system') // default
      expect(entry.status).toBe('success')
      expect(entry.error).toBeNull()
      expect(entry.createdAt).toBeInstanceOf(Date)
    })

    it('should create an audit entry with all fields', async () => {
      const entry = await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId: '456',
        action: AuditActions.NotificationFailed,
        actor: 'cron:notifications',
        metadata: {
          conversationId: 'cnv_abc123',
          attemptNumber: 3,
        },
        status: AuditStatus.Failed,
        error: 'Front API timeout',
      })

      expect(entry.actor).toBe('cron:notifications')
      expect(entry.metadata).toEqual({
        conversationId: 'cnv_abc123',
        attemptNumber: 3,
      })
      expect(entry.status).toBe('failed')
      expect(entry.error).toBe('Front API timeout')
    })
  })

  describe('createMany', () => {
    it('should create multiple audit entries in a transaction', async () => {
      const entries = await repository.createMany([
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '100',
          action: AuditActions.ShipmentCreated,
          status: AuditStatus.Success,
        },
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '100',
          action: AuditActions.ThreadSearched,
          status: AuditStatus.Success,
          metadata: { candidatesFound: 2 },
        },
      ])

      expect(entries).toHaveLength(2)
      expect(entries[0].action).toBe('shipment.created')
      expect(entries[1].action).toBe('thread.searched')
    })
  })

  describe('getHistory', () => {
    // Helper to create standard test entries for getHistory tests
    async function createTestEntries(entityId: string) {
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.ShipmentCreated,
        status: AuditStatus.Success,
      })
      await new Promise((r) => setTimeout(r, 15))
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.ThreadSearched,
        status: AuditStatus.Success,
      })
      await new Promise((r) => setTimeout(r, 15))
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationSent,
        status: AuditStatus.Success,
      })
    }

    it('should return entries in reverse chronological order', async () => {
      await createTestEntries('200')
      
      const history = await repository.getHistory({
        entityType: AuditEntityTypes.Shipment,
        entityId: '200',
      })

      expect(history).toHaveLength(3)
      expect(history[0].action).toBe('notification.sent') // most recent
      expect(history[2].action).toBe('shipment.created') // oldest
    })

    it('should filter by action', async () => {
      await createTestEntries('201')
      
      const history = await repository.getHistory({
        entityType: AuditEntityTypes.Shipment,
        entityId: '201',
        action: AuditActions.ThreadSearched,
      })

      expect(history).toHaveLength(1)
      expect(history[0].action).toBe('thread.searched')
    })

    it('should respect limit and offset', async () => {
      await createTestEntries('202')
      
      const history = await repository.getHistory({
        entityType: AuditEntityTypes.Shipment,
        entityId: '202',
        limit: 2,
        offset: 1,
      })

      expect(history).toHaveLength(2)
      expect(history[0].action).toBe('thread.searched')
      expect(history[1].action).toBe('shipment.created')
    })

    it('should return empty array for non-existent entity', async () => {
      const history = await repository.getHistory({
        entityType: AuditEntityTypes.Shipment,
        entityId: 'non-existent',
      })

      expect(history).toHaveLength(0)
    })
  })

  describe('hasAction', () => {
    // Helper to create test entries for hasAction tests
    async function createHasActionEntries(entityId: string) {
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationSent,
        status: AuditStatus.Success,
      })
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationFailed,
        status: AuditStatus.Failed,
      })
    }

    it('should return true if action exists', async () => {
      await createHasActionEntries('300')
      
      const exists = await repository.hasAction({
        entityType: AuditEntityTypes.Shipment,
        entityId: '300',
        action: AuditActions.NotificationSent,
      })

      expect(exists).toBe(true)
    })

    it('should return false if action does not exist', async () => {
      await createHasActionEntries('301')
      
      const exists = await repository.hasAction({
        entityType: AuditEntityTypes.Shipment,
        entityId: '301',
        action: AuditActions.ShipmentCreated,
      })

      expect(exists).toBe(false)
    })

    it('should filter by status', async () => {
      await createHasActionEntries('302')
      
      const existsSuccess = await repository.hasAction({
        entityType: AuditEntityTypes.Shipment,
        entityId: '302',
        action: AuditActions.NotificationSent,
        status: AuditStatus.Success,
      })

      const existsFailed = await repository.hasAction({
        entityType: AuditEntityTypes.Shipment,
        entityId: '302',
        action: AuditActions.NotificationSent,
        status: AuditStatus.Failed,
      })

      expect(existsSuccess).toBe(true)
      expect(existsFailed).toBe(false)
    })
  })

  describe('getLatest', () => {
    // Helper to create test entries for getLatest tests
    async function createGetLatestEntries(entityId: string) {
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationFailed,
        status: AuditStatus.Failed,
        error: 'First failure',
      })
      await new Promise((r) => setTimeout(r, 15))
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationFailed,
        status: AuditStatus.Failed,
        error: 'Second failure',
      })
      await new Promise((r) => setTimeout(r, 15))
      await repository.create({
        entityType: AuditEntityTypes.Shipment,
        entityId,
        action: AuditActions.NotificationSent,
        status: AuditStatus.Success,
      })
    }

    it('should return the most recent entry', async () => {
      await createGetLatestEntries('400')
      
      const latest = await repository.getLatest(AuditEntityTypes.Shipment, '400')

      expect(latest).not.toBeNull()
      expect(latest!.action).toBe('notification.sent')
    })

    it('should return the most recent entry for specific action', async () => {
      await createGetLatestEntries('401')
      
      const latest = await repository.getLatest(
        AuditEntityTypes.Shipment,
        '401',
        AuditActions.NotificationFailed
      )

      expect(latest).not.toBeNull()
      expect(latest!.error).toBe('Second failure')
    })

    it('should return null for non-existent entity', async () => {
      const latest = await repository.getLatest(
        AuditEntityTypes.Shipment,
        'non-existent'
      )

      expect(latest).toBeNull()
    })
  })

  describe('count', () => {
    it('should count all entries for entity', async () => {
      await repository.createMany([
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '500',
          action: AuditActions.ShipmentCreated,
          status: AuditStatus.Success,
        },
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '500',
          action: AuditActions.NotificationSent,
          status: AuditStatus.Success,
        },
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '500',
          action: AuditActions.NotificationSent,
          status: AuditStatus.Success,
        },
      ])

      const count = await repository.count({
        entityType: AuditEntityTypes.Shipment,
        entityId: '500',
      })

      expect(count).toBe(3)
    })

    it('should count entries filtered by action', async () => {
      await repository.createMany([
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '501',
          action: AuditActions.ShipmentCreated,
          status: AuditStatus.Success,
        },
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '501',
          action: AuditActions.NotificationSent,
          status: AuditStatus.Success,
        },
        {
          entityType: AuditEntityTypes.Shipment,
          entityId: '501',
          action: AuditActions.NotificationSent,
          status: AuditStatus.Success,
        },
      ])

      const count = await repository.count({
        entityType: AuditEntityTypes.Shipment,
        entityId: '501',
        action: AuditActions.NotificationSent,
      })

      expect(count).toBe(2)
    })
  })
})
