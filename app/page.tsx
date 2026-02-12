'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs'
import ShipmentTable from '@/components/ShipmentTable'
import StatusTabs from '@/components/StatusTabs'
import LastSyncDisplay, { LastSyncDisplayRef } from '@/components/LastSyncDisplay'
import RefreshNow from '@/components/RefreshNow'
import StaleDataBanner from '@/components/StaleDataBanner'
import { api } from '@/lib/orpc/client'
import type { ShipmentFilter as SchemaShipmentFilter, ShipmentSort as SchemaShipmentSort } from '@/lib/orpc/schemas'

interface TrackingEvent {
  id: number
  status?: string | null
  location?: string | null
  message?: string | null
  eventTime?: string | null
}

interface Shipment {
  id: number
  trackingNumber: string
  carrier?: string | null
  status: string
  poNumber?: string | null
  supplier?: string | null
  shippedDate?: string | null
  estimatedDelivery?: string | null
  deliveredDate?: string | null
  ship24Status?: string | null
  ship24LastUpdate?: string | null
  lastChecked?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
  trackingEvents?: TrackingEvent[]
}

type ShipmentFilter = SchemaShipmentFilter
type ShipmentSort = SchemaShipmentSort

interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface StatusCounts {
  all: number
  pending: number
  infoReceived: number
  inTransit: number
  outForDelivery: number
  failedAttempt: number
  availableForPickup: number
  delivered: number
  exception: number
  trackingErrors: number
}

// Valid status tab values
const statusTabs = [
  'all',
  'pending',
  'info_received',
  'in_transit',
  'out_for_delivery',
  'failed_attempt',
  'available_for_pickup',
  'delivered',
  'exception',
  'trackingErrors',
]

type StatusTab = typeof statusTabs[number]

// Valid sort fields
const sortFields = ['shippedDate', 'estimatedDelivery', 'deliveredDate', 'createdAt']
type SortField = 'shippedDate' | 'estimatedDelivery' | 'deliveredDate' | 'createdAt'

const sortDirections = ['asc', 'desc']
type SortDirection = 'asc' | 'desc'

export default function Home() {
  const lastSyncRef = useRef<LastSyncDisplayRef>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  
  // URL Query State (nuqs)
  const [tab, setTab] = useQueryState('tab', parseAsStringEnum(statusTabs).withDefault('all'))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [sortField, setSortField] = useQueryState('sortField', parseAsStringEnum(sortFields))
  const [sortDir, setSortDir] = useQueryState('sortDir', parseAsStringEnum(sortDirections).withDefault('desc'))
  
  // Local state for data
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    pending: 0,
    infoReceived: 0,
    inTransit: 0,
    outForDelivery: 0,
    failedAttempt: 0,
    availableForPickup: 0,
    delivered: 0,
    exception: 0,
    trackingErrors: 0,
  })
  const [paginationMeta, setPaginationMeta] = useState<Omit<PaginationData, 'page'>>({
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Derive filter from URL state (memoized to prevent infinite loops)
  const filter: ShipmentFilter = useMemo(() => {
    const f: ShipmentFilter = {}
    if (search) f.search = search
    if (tab === 'trackingErrors') {
      f.hasError = true
    } else if (tab !== 'all') {
      f.status = tab as ShipmentFilter['status']
    }
    return f
  }, [search, tab])

  // Derive sort from URL state (memoized to prevent infinite loops)
  const sort: SchemaShipmentSort | undefined = useMemo(() => {
    return sortField 
      ? { field: sortField as SchemaShipmentSort['field'], direction: sortDir as SchemaShipmentSort['direction'] }
      : undefined
  }, [sortField, sortDir])

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await api.shipments.list({
        pagination: {
          page,
          pageSize: 20,
        },
        filter,
        sort,
      })
      
      setShipments(data.items)
      setPaginationMeta({
        pageSize: data.pagination.pageSize,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        hasNext: data.pagination.hasNext,
        hasPrev: data.pagination.hasPrev,
      })
      setStatusCounts(data.statusCounts)
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
      setError('Failed to fetch shipments')
      setShipments([])
    } finally {
      setLoading(false)
    }
  }, [page, filter, sort])

  useEffect(() => {
    fetchShipments()
  }, [fetchShipments])

  // Combined pagination object for ShipmentTable
  const pagination: PaginationData = {
    page,
    ...paginationMeta,
  }

  const handleQueryChange = useCallback((newQuery: {
    pagination?: { page: number; pageSize: number }
    filter?: ShipmentFilter
    sort?: ShipmentSort
  }) => {
    if (newQuery.pagination?.page) {
      setPage(newQuery.pagination.page)
    }
    if (newQuery.filter !== undefined) {
      // Update search from filter
      if (newQuery.filter.search !== undefined) {
        setSearch(newQuery.filter.search || null)
      }
      // Reset to page 1 when filter changes
      setPage(1)
    }
    if (newQuery.sort !== undefined) {
      if (newQuery.sort) {
        setSortField(newQuery.sort.field as SortField)
        setSortDir(newQuery.sort.direction)
      } else {
        setSortField(null)
      }
    }
  }, [setPage, setSearch, setSortField, setSortDir])

  const handleStatusChange = useCallback((status: string) => {
    setTab(status as StatusTab)
    setPage(1) // Reset to page 1 when tab changes
  }, [setTab, setPage])

  const handleRefresh = useCallback(() => {
    fetchShipments()
    lastSyncRef.current?.refresh()
    setRefreshCounter(c => c + 1)
  }, [fetchShipments])

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Shipment Tracking Dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Monitor all shipments and tracking status
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <LastSyncDisplay ref={lastSyncRef} />
              <RefreshNow onSuccess={handleRefresh} />
            </div>
          </div>
        </div>

        {/* Stale Data Warning */}
        <StaleDataBanner onRefresh={handleRefresh} refreshTrigger={refreshCounter} />

        {/* Status Tabs */}
        <StatusTabs
          counts={statusCounts}
          activeTab={tab}
          onTabChange={handleStatusChange}
        />

        {loading && !shipments.length ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : (
          <ShipmentTable 
            shipments={shipments} 
            pagination={pagination}
            onQueryChange={handleQueryChange}
            loading={loading}
            activeStatus={tab}
            onShipmentRefreshed={handleRefresh}
            initialSearch={search}
            initialSort={sort}
          />
        )}
      </div>
    </main>
  )
}
