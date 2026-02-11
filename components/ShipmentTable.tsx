'use client'

import { useState, useEffect } from 'react'
import { format, formatDistanceToNow, addDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, MapPin, Clock, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, TruckIcon, Search, Copy, Check } from 'lucide-react'
import type { ShipmentFilter, ShipmentSort } from '@/lib/orpc/schemas'

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
  createdAt: string
  lastError: string | null
  trackingEvents?: TrackingEvent[]
}

interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ShipmentTableProps {
  shipments: Shipment[]
  pagination: PaginationData
  onQueryChange: (query: {
    pagination?: { page: number; pageSize: number }
    filter?: ShipmentFilter
    sort?: ShipmentSort
  }) => void
  loading?: boolean
}

type SortField = 'shippedDate' | 'estimatedDelivery' | 'deliveredDate' | 'createdAt'

export default function ShipmentTable({ shipments, pagination, onQueryChange, loading }: ShipmentTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null)

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, statusFilter])

  const applyFilters = () => {
    const filter: Record<string, string> = {}
    
    // Single search across tracking, PO, and supplier
    if (searchQuery) filter.search = searchQuery
    if (statusFilter !== 'all') filter.status = statusFilter

    const sort = sortField ? {
      field: sortField,
      direction: sortDirection,
    } : undefined

    onQueryChange({
      pagination: { page: 1, pageSize: pagination.pageSize },
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      sort,
    })
  }

  const handleSort = (field: SortField) => {
    let newDirection: 'asc' | 'desc' = 'asc'
    
    if (sortField === field) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        newDirection = 'desc'
      } else {
        // Clear sort
        setSortField(null)
        onQueryChange({
          pagination: { page: pagination.page, pageSize: pagination.pageSize },
          filter: buildCurrentFilter(),
          sort: undefined,
        })
        return
      }
    }

    setSortField(field)
    setSortDirection(newDirection)
    
    onQueryChange({
      pagination: { page: pagination.page, pageSize: pagination.pageSize },
      filter: buildCurrentFilter(),
      sort: { field, direction: newDirection },
    })
  }

  const buildCurrentFilter = (): Record<string, string> | undefined => {
    const filter: Record<string, string> = {}
    if (searchQuery) filter.search = searchQuery
    if (statusFilter !== 'all') filter.status = statusFilter
    return Object.keys(filter).length > 0 ? filter : undefined
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4" />
    }
    return <ArrowDown className="h-4 w-4" />
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSortField(null)
    onQueryChange({
      pagination: { page: 1, pageSize: pagination.pageSize },
    })
  }

  const handlePageChange = (newPage: number) => {
    onQueryChange({
      pagination: { page: newPage, pageSize: pagination.pageSize },
      filter: buildCurrentFilter(),
      sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
    })
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || sortField

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500'
      case 'in_transit':
        return 'bg-blue-500'
      case 'out_for_delivery':
        return 'bg-purple-500'
      case 'exception':
        return 'bg-red-500'
      case 'pending':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), 'MMM d, yyyy')
    } catch {
      return null
    }
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), 'MMM d, h:mm a')
    } catch {
      return null
    }
  }

  // Calculate expected delivery estimate (shipped + 5 business days)
  const getExpectedDelivery = (shipment: Shipment) => {
    // If we have carrier estimate, use it
    if (shipment.estimatedDelivery) {
      return {
        date: formatDate(shipment.estimatedDelivery),
        source: 'carrier' as const
      }
    }
    
    // Otherwise estimate based on shipped date (if available)
    if (shipment.shippedDate && shipment.status !== 'delivered') {
      const shipped = new Date(shipment.shippedDate)
      const estimated = addDays(shipped, 5) // 5 business days estimate
      return {
        date: formatDate(estimated.toISOString()),
        source: 'estimated' as const
      }
    }
    
    return null
  }

  const getLatestEvent = (events?: TrackingEvent[]) => {
    if (!events || events.length === 0) return null
    return events[0]
  }

  const handleCopyTracking = async (trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopiedTracking(trackingNumber)
      setTimeout(() => {
        setCopiedTracking((prev) => (prev === trackingNumber ? null : prev))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy tracking number', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tracking #, PO #, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="exception">Exception</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loading}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking Number</TableHead>
              <TableHead>PO / Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 hover:bg-transparent"
                  onClick={() => handleSort('shippedDate')}
                  disabled={loading}
                >
                  Shipped
                  {getSortIcon('shippedDate')}
                </Button>
              </TableHead>
              <TableHead>
                Expected
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 hover:bg-transparent"
                  onClick={() => handleSort('deliveredDate')}
                  disabled={loading}
                >
                  Delivered
                  {getSortIcon('deliveredDate')}
                </Button>
              </TableHead>
              <TableHead>Latest Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {hasActiveFilters ? 'No shipments match your search' : 'No shipments found'}
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => {
                const latestEvent = getLatestEvent(shipment.trackingEvents)
                const shippedDate = formatDate(shipment.shippedDate)
                const expectedInfo = getExpectedDelivery(shipment)
                const deliveredDate = formatDateTime(shipment.deliveredDate)

                return (
                  <TableRow key={shipment.id} className={loading ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{shipment.trackingNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTracking(shipment.trackingNumber)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label={`Copy tracking number ${shipment.trackingNumber}`}
                          >
                            {copiedTracking === shipment.trackingNumber ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground uppercase">
                            {shipment.carrier || 'Unknown'}
                          </span>
                          {shipment.lastError && (
                            <span title={shipment.lastError}>
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {shipment.supplier && (
                          <span className="text-sm">{shipment.supplier}</span>
                        )}
                        {shipment.poNumber && (
                          <span className="text-xs text-muted-foreground">PO: {shipment.poNumber}</span>
                        )}
                        {!shipment.supplier && !shipment.poNumber && <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status.replace('_', ' ')}
                        </Badge>
                        {shipment.ship24Status && shipment.ship24Status !== shipment.status && (
                          <span className="text-xs text-muted-foreground">
                            {shipment.ship24Status}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {shippedDate ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          <span>{shippedDate}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {expectedInfo ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            {expectedInfo.source === 'carrier' ? (
                              <TruckIcon className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            <span>{expectedInfo.date}</span>
                          </div>
                          {expectedInfo.source === 'estimated' && (
                            <span className="text-xs text-muted-foreground ml-5">~5 days</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {deliveredDate ? (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{deliveredDate}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {latestEvent ? (
                        <div className="flex flex-col gap-1 max-w-[250px]">
                          {latestEvent.location && (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{latestEvent.location}</span>
                            </div>
                          )}
                          {latestEvent.message && (
                            <span className="text-xs text-muted-foreground truncate">
                              {latestEvent.message}
                            </span>
                          )}
                          {latestEvent.eventTime && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(latestEvent.eventTime), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      ) : shipment.ship24LastUpdate ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(shipment.ship24LastUpdate), { addSuffix: true })}
                        </span>
                      ) : shipment.lastChecked ? (
                        <span className="text-xs text-muted-foreground">
                          Checked {formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {shipments.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} shipments
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
