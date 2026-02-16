/**
 * Prisma implementation of AuditRepository.
 * 
 * Stores audit entries in the audit_history table.
 * This is append-only - entries are never updated or deleted.
 */

import type { PrismaClient, Prisma } from '@prisma/client'
import type {
  AuditRepository,
  AuditEntry,
  AuditHistoryQuery,
  CreateAuditEntryInput,
  HasActionQuery,
} from '@/lib/domain/audit'

/**
 * Map Prisma record to domain AuditEntry.
 */
function toDomainEntry(record: {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor: string
  metadata: unknown
  status: string
  error: string | null
  created_at: Date
}): AuditEntry {
  return {
    id: record.id,
    entityType: record.entity_type,
    entityId: record.entity_id,
    action: record.action,
    actor: record.actor,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    status: record.status,
    error: record.error,
    createdAt: record.created_at,
  }
}

export function createPrismaAuditRepository(prisma: PrismaClient): AuditRepository {
  return {
    async create(input: CreateAuditEntryInput): Promise<AuditEntry> {
      const record = await prisma.audit_history.create({
        data: {
          entity_type: input.entityType,
          entity_id: input.entityId,
          action: input.action,
          actor: input.actor ?? 'system',
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          status: input.status,
          error: input.error ?? null,
        },
      })

      return toDomainEntry(record)
    },

    async createMany(inputs: CreateAuditEntryInput[]): Promise<AuditEntry[]> {
      // Prisma's createMany doesn't return the created records,
      // so we use a transaction with individual creates
      const records = await prisma.$transaction(
        inputs.map((input) =>
          prisma.audit_history.create({
            data: {
              entity_type: input.entityType,
              entity_id: input.entityId,
              action: input.action,
              actor: input.actor ?? 'system',
              metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
              status: input.status,
              error: input.error ?? null,
            },
          })
        )
      )

      return records.map(toDomainEntry)
    },

    async getHistory(query: AuditHistoryQuery): Promise<AuditEntry[]> {
      const records = await prisma.audit_history.findMany({
        where: {
          entity_type: query.entityType,
          entity_id: query.entityId,
          ...(query.action && { action: query.action }),
        },
        orderBy: { created_at: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      })

      return records.map(toDomainEntry)
    },

    async hasAction(query: HasActionQuery): Promise<boolean> {
      const count = await prisma.audit_history.count({
        where: {
          entity_type: query.entityType,
          entity_id: query.entityId,
          action: query.action,
          ...(query.status && { status: query.status }),
        },
      })

      return count > 0
    },

    async getLatest(
      entityType: string,
      entityId: string,
      action?: string
    ): Promise<AuditEntry | null> {
      const record = await prisma.audit_history.findFirst({
        where: {
          entity_type: entityType,
          entity_id: entityId,
          ...(action && { action }),
        },
        orderBy: { created_at: 'desc' },
      })

      return record ? toDomainEntry(record) : null
    },

    async count(query: Omit<AuditHistoryQuery, 'limit' | 'offset'>): Promise<number> {
      return prisma.audit_history.count({
        where: {
          entity_type: query.entityType,
          entity_id: query.entityId,
          ...(query.action && { action: query.action }),
        },
      })
    },
  }
}
