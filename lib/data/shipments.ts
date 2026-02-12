import { prisma } from '@/lib/prisma'
import { serializeShipments } from '@/lib/infrastructure/repositories/serializers'

export interface ShipmentQueryParams {
  tab?: string
  page?: string
  search?: string
  sortField?: string
  sortDir?: string
}

export interface ShipmentFilter {
  search?: string
  status?: string
  hasError?: boolean
}

export interface ShipmentSort {
  field: string
  direction: 'asc' | 'desc'
}

function buildWhereClause(filter: ShipmentFilter) {
  const where: Record<string, unknown> = {}

  if (filter.search) {
    where.OR = [
      { tracking_number: { contains: filter.search, mode: 'insensitive' } },
      { po_number: { contains: filter.search, mode: 'insensitive' } },
      { supplier: { contains: filter.search, mode: 'insensitive' } },
    ]
  }

  if (filter.status) {
    where.status = filter.status
  }

  if (filter.hasError) {
    where.last_error = { not: null }
  }

  return where
}

function buildOrderByClause(sort?: ShipmentSort) {
  if (!sort) {
    return { created_at: 'desc' as const }
  }

  const fieldMap: Record<string, string> = {
    shippedDate: 'shipped_date',
    estimatedDelivery: 'estimated_delivery',
    deliveredDate: 'delivered_date',
    createdAt: 'created_at',
  }

  const dbField = fieldMap[sort.field] || 'created_at'
  return { [dbField]: sort.direction }
}

export async function getShipments(params: ShipmentQueryParams) {
  const page = parseInt(params.page || '1', 10)
  const pageSize = 20
  const skip = (page - 1) * pageSize

  // Build filter from params
  const filter: ShipmentFilter = {}
  if (params.search) filter.search = params.search
  if (params.tab === 'trackingErrors') {
    filter.hasError = true
  } else if (params.tab && params.tab !== 'all') {
    filter.status = params.tab
  }

  // Build sort from params
  const sort: ShipmentSort | undefined = params.sortField
    ? { field: params.sortField, direction: (params.sortDir as 'asc' | 'desc') || 'desc' }
    : undefined

  const where = buildWhereClause(filter)
  const orderBy = buildOrderByClause(sort)

  // Get counts for all statuses
  const searchFilter = filter.search
    ? {
        OR: [
          { tracking_number: { contains: filter.search, mode: 'insensitive' as const } },
          { po_number: { contains: filter.search, mode: 'insensitive' as const } },
          { supplier: { contains: filter.search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [
    total,
    pending,
    infoReceived,
    inTransit,
    outForDelivery,
    failedAttempt,
    availableForPickup,
    delivered,
    exception,
    trackingErrors,
    filteredTotal,
    shipments,
  ] = await Promise.all([
    prisma.shipments.count({ where: searchFilter }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'pending' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'info_received' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'in_transit' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'out_for_delivery' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'failed_attempt' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'available_for_pickup' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'delivered' } }),
    prisma.shipments.count({ where: { ...searchFilter, status: 'exception' } }),
    prisma.shipments.count({ where: { ...searchFilter, last_error: { not: null } } }),
    prisma.shipments.count({ where }),
    prisma.shipments.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        tracking_events: {
          orderBy: { event_time: 'desc' },
          take: 5,
        },
      },
    }),
  ])

  const serialized = serializeShipments(shipments)

  // Format for API response
  const items = serialized.map((s) => ({
    id: s.id,
    trackingNumber: s.trackingNumber,
    carrier: s.carrier,
    status: s.status,
    poNumber: s.poNumber,
    supplier: s.supplier,
    shippedDate: s.shippedDate?.toISOString() ?? null,
    estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
    deliveredDate: s.deliveredDate?.toISOString() ?? null,
    ship24Status: s.ship24Status,
    ship24LastUpdate: s.ship24LastUpdate?.toISOString() ?? null,
    lastChecked: s.lastChecked?.toISOString() ?? null,
    lastError: s.lastError,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    trackingEvents: s.trackingEvents?.map((e) => ({
      id: e.id,
      status: e.status,
      location: e.location,
      message: e.message,
      eventTime: e.eventTime?.toISOString() ?? null,
    })),
  }))

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: filteredTotal,
      totalPages: Math.ceil(filteredTotal / pageSize),
      hasNext: page * pageSize < filteredTotal,
      hasPrev: page > 1,
    },
    statusCounts: {
      all: total,
      pending,
      infoReceived,
      inTransit,
      outForDelivery,
      failedAttempt,
      availableForPickup,
      delivered,
      exception,
      trackingErrors,
    },
  }
}
