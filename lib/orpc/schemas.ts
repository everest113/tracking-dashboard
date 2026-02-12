import { z } from 'zod'

/**
 * Standard pagination input schema
 */
export const PaginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

/**
 * Standard sort input schema
 */
export const SortInputSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * Shipment filter schema
 */
export const ShipmentFilterSchema = z.object({
  // Unified search across tracking #, PO #, and supplier
  search: z.string().optional(),
  // Legacy individual filters (kept for backwards compatibility)
  trackingNumber: z.string().optional(),
  poNumber: z.string().optional(),
  supplier: z.string().optional(),
  // Category filters
  status: z.enum(['pending', 'info_received', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'failed_attempt', 'available_for_pickup']).optional(),
  carrier: z.string().optional(),
  hasError: z.boolean().optional(),
})

/**
 * Shipment sort fields
 */
export const ShipmentSortSchema = SortInputSchema.extend({
  field: z.enum(['trackingNumber', 'poNumber', 'supplier', 'status', 'shippedDate', 'estimatedDelivery', 'deliveredDate', 'createdAt']),
})

/**
 * Complete shipment list query schema
 */
export const ShipmentListQuerySchema = z.object({
  pagination: PaginationInputSchema.optional(),
  filter: ShipmentFilterSchema.optional(),
  sort: ShipmentSortSchema.optional(),
})

/**
 * Status counts schema
 */
export const StatusCountsSchema = z.object({
  all: z.number(),
  pending: z.number(),
  infoReceived: z.number(),
  inTransit: z.number(),
  outForDelivery: z.number(),
  failedAttempt: z.number(),
  availableForPickup: z.number(),
  delivered: z.number(),
  exception: z.number(),
  trackingErrors: z.number(),
})

/**
 * Standard paginated response schema
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
    statusCounts: StatusCountsSchema,
  })

/**
 * Shipment summary/stats schema
 */
export const ShipmentSummarySchema = z.object({
  total: z.number(),
  pending: z.number(),
  inTransit: z.number(),
  delivered: z.number(),
  overdue: z.number(),
  exceptions: z.number(),
  trackingErrors: z.number(),
  neverChecked: z.number(),
})

/**
 * Type exports
 */
export type PaginationInput = z.infer<typeof PaginationInputSchema>
export type SortInput = z.infer<typeof SortInputSchema>
export type ShipmentFilter = z.infer<typeof ShipmentFilterSchema>
export type ShipmentSort = z.infer<typeof ShipmentSortSchema>
export type ShipmentListQuery = z.infer<typeof ShipmentListQuerySchema>
export type ShipmentSummary = z.infer<typeof ShipmentSummarySchema>

/**
 * Helper to build Prisma where clause from filters
 */
export function buildShipmentWhereClause(filter?: ShipmentFilter) {
  if (!filter) return {}

  const where: Record<string, unknown> = {}

  // Unified search: search across tracking_number, po_number, and supplier
  if (filter.search) {
    where.OR = [
      { tracking_number: { contains: filter.search, mode: 'insensitive' } },
      { po_number: { contains: filter.search, mode: 'insensitive' } },
      { supplier: { contains: filter.search, mode: 'insensitive' } },
    ]
  }

  // Legacy individual filters (backwards compatibility)
  if (filter.trackingNumber) {
    where.tracking_number = { contains: filter.trackingNumber, mode: 'insensitive' }
  }

  if (filter.poNumber) {
    where.po_number = { contains: filter.poNumber, mode: 'insensitive' }
  }

  if (filter.supplier) {
    where.supplier = { contains: filter.supplier, mode: 'insensitive' }
  }

  // Category filters (exact match)
  if (filter.status) {
    where.status = filter.status
  }

  if (filter.carrier) {
    where.carrier = { contains: filter.carrier, mode: 'insensitive' }
  }

  // Filter by tracking errors
  if (filter.hasError) {
    where.last_error = { not: null }
  }

  return where
}

/**
 * Helper to build Prisma orderBy clause from sort
 */
export function buildShipmentOrderByClause(sort?: ShipmentSort) {
  if (!sort) return { created_at: 'desc' as const }

  const fieldMap: Record<string, string> = {
    trackingNumber: 'tracking_number',
    poNumber: 'po_number',
    supplier: 'supplier',
    status: 'status',
    shippedDate: 'shipped_date',
    estimatedDelivery: 'estimated_delivery',
    deliveredDate: 'delivered_date',
    createdAt: 'created_at',
  }

  const dbField = fieldMap[sort.field] || 'created_at'
  return { [dbField]: sort.direction }
}
