/**
 * Repository type definitions
 * Provides type-safe bridge between Prisma models and domain entities
 */

import type { Prisma } from '@prisma/client'

/**
 * Prisma model types
 * Import these instead of using 'any'
 */
export type PrismaShipment = Prisma.shipmentsGetPayload<object>
export type PrismaTrackingEvent = Prisma.tracking_eventsGetPayload<object>
export type PrismaScannedConversation = Prisma.scanned_conversationsGetPayload<object>
export type PrismaSyncHistory = Prisma.sync_historyGetPayload<object>

/**
 * Prisma create inputs
 */
export type PrismaShipmentCreate = Prisma.shipmentsCreateInput
export type PrismaShipmentUpdate = Prisma.shipmentsUpdateInput
export type PrismaTrackingEventCreate = Prisma.tracking_eventsCreateInput

/**
 * Type guard to check if a value is a valid Prisma shipment
 */
export function isPrismaShipment(value: unknown): value is PrismaShipment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tracking_number' in value
  )
}

/**
 * Base repository result types
 */
export type RepositoryResult<T> = 
  | { success: true; data: T }
  | { success: false; error: Error }

/**
 * Pagination types
 */
export type PaginationOptions = {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
