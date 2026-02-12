'use client'

import { useState, useEffect, useRef } from 'react'
import ShipmentTable from '@/components/ShipmentTable'
import StatusCards from '@/components/StatusCards'
import LastSyncDisplay, { LastSyncDisplayRef } from '@/components/LastSyncDisplay'
import RefreshNow from '@/components/RefreshNow'
import StaleDataBanner from '@/components/StaleDataBanner'
import { api } from '@/lib/orpc/client'
import type { ShipmentFilter as SchemaShipmentFilter, ShipmentSort as SchemaShipmentSort, ShipmentSummary } from '@/lib/orpc/schemas'

interface TrackingEvent {
  id: number
  status: string | null
  location: string | null
  message: string | null
  eventTime: string | null
}

interface Shipment {
  id: number
  trackingNumber: string
  carrier: string | null
  status: string
  poNumber: string | null
  supplier: string | null
  shippedDate: string | null
  estimatedDelivery: string | null
  deliveredDate: string | null
  ship24Status: string | null
  ship24LastUpdate: string | null
  lastChecked: string | null
  lastError: string | null
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

export default function Home() {
  const lastSyncRef = useRef<LastSyncDisplayRef>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [summary, setSummary] = useState<ShipmentSummary>({
    total: 0,
    pending: 0,
    inTransit: 0,
    delivered: 0,
    overdue: 0,
    exceptions: 0,
    trackingErrors: 0,
    neverChecked: 0,
  })
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })
  const [filter, setFilter] = useState<ShipmentFilter>({})
  const [sort, setSort] = useState<ShipmentSort | undefined>()
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setSummaryLoading(true)
    
    try {
      const data = await api.shipments.summary()
      setSummary(data)
    } catch (err) {
      console.error('Failed to fetch summary:', err)
      // Don't show error for summary, just log it
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchShipments = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await api.shipments.list({
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
        },
        filter: {
          trackingNumber: filter.trackingNumber,
          poNumber: filter.poNumber,
          supplier: filter.supplier,
          status: filter.status,
          carrier: filter.carrier,
        },
        sort: sort ? {
          field: sort.field,
          direction: sort.direction,
        } : undefined,
      })
      
      setShipments(data.items)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
      setError('Failed to fetch shipments')
      setShipments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  useEffect(() => {
    fetchShipments()
  }, [pagination.page, filter, sort])

  const handleQueryChange = (newQuery: {
    pagination?: { page: number; pageSize: number }
    filter?: ShipmentFilter
    sort?: ShipmentSort
  }) => {
    if (newQuery.pagination) {
      setPagination(prev => ({ ...prev, ...newQuery.pagination }))
    }
    if (newQuery.filter !== undefined) {
      setFilter(newQuery.filter)
      // Reset to page 1 when filter changes
      setPagination(prev => ({ ...prev, page: 1 }))
    }
    if (newQuery.sort !== undefined) {
      setSort(newQuery.sort)
    }
  }

  const handleRefresh = () => {
    fetchSummary()
    fetchShipments()
    lastSyncRef.current?.refresh()
    setRefreshCounter(c => c + 1) // Trigger stale banner re-check
  }

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

        {/* Status Cards */}
        <div className="mb-8">
          <StatusCards summary={summary} loading={summaryLoading} />
        </div>

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
          />
        )}
      </div>
    </main>
  )
}
