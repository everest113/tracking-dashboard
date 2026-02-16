/**
 * Audit Infrastructure Module
 * 
 * Provides the audit service singleton and repository implementation.
 */

import { prisma } from '@/lib/prisma'
import { createPrismaAuditRepository } from './PrismaAuditRepository'
import { createAuditService, type AuditService } from './AuditService'

export { createPrismaAuditRepository } from './PrismaAuditRepository'
export { createAuditService, type AuditService } from './AuditService'

// Singleton instance
let auditService: AuditService | null = null

/**
 * Get the audit service singleton.
 */
export function getAuditService(): AuditService {
  if (!auditService) {
    const repository = createPrismaAuditRepository(prisma)
    auditService = createAuditService(repository)
  }
  return auditService
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetAuditService(): void {
  auditService = null
}
