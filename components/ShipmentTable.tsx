'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
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
import { Package, MapPin, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, TruckIcon, Search, Copy, Check, RefreshCw, Loader2, MoreHorizontal, Trash2, ExternalLink, Upload } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/orpc/client'
import RefreshNow from '@/components/RefreshNow'

interface TrackingEvent {
  id: number
  status?: string | null
  location?: string | null
  message?: string | null
  eventTime?: string | null
}

interface OmgData {
  orderName?: string | null
  customerName?: string | null
  orderUrl: string
  poUrl: string
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
  createdAt: string
  lastError?: string | null
  trackingEvents?: TrackingEvent[]
  omgData?: OmgData | null
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
  activeStatus?: string
}

type SortField = 'shippedDate' | 'estimatedDelivery' | 'deliveredDate' | 'createdAt'

export default function ShipmentTable({ 
  shipments, 
  pagination, 
  activeStatus = 'all',
}: ShipmentTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Local state for controlled inputs
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null)
  const [refreshingShipmentId, setRefreshingShipmentId] = useState<number | null>(null)
  const [deletingShipmentId, setDeletingShipmentId] = useState<number | null>(null)
  const [syncingToOmgId, setSyncingToOmgId] = useState<number | null>(null)

  // Get current sort from URL
  const sortField = searchParams.get('sortField') as SortField | null
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'

  // URL update helper
  const updateUrl = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    
    const query = params.toString()
    router.push(query ? `/?${query}` : '/')
  }, [router, searchParams])

  // Handlers
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    updateUrl({ search: searchInput || null, page: null })
  }, [searchInput, updateUrl])

  const handleSort = useCallback((field: SortField) => {
    let newDir: 'asc' | 'desc' = 'asc'
    
    if (sortField === field) {
      if (sortDir === 'asc') {
        newDir = 'desc'
      } else {
        // Third click clears sort
        updateUrl({ sortField: null, sortDir: null })
        return
      }
    }
    
    updateUrl({ sortField: field, sortDir: newDir })
  }, [sortField, sortDir, updateUrl])

  const handlePageChange = useCallback((newPage: number) => {
    updateUrl({ page: newPage === 1 ? null : String(newPage) })
  }, [updateUrl])

  const clearFilters = useCallback(() => {
    setSearchInput('')
    updateUrl({ search: null, sortField: null, sortDir: null, page: null })
  }, [updateUrl])

  const handleRefreshShipment = async (shipmentId: number) => {
    setRefreshingShipmentId(shipmentId)
    try {
      await api.manualUpdateTracking.refreshOne({ shipmentId })
      router.refresh()
    } catch (error) {
      console.error('Failed to refresh shipment:', error)
    } finally {
      setRefreshingShipmentId(null)
    }
  }

  const handleDeleteShipment = async (shipmentId: number) => {
    if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
      return
    }
    
    setDeletingShipmentId(shipmentId)
    try {
      await api.shipments.delete({ shipmentId })
      router.refresh()
    } catch (error) {
      console.error('Failed to delete shipment:', error)
    } finally {
      setDeletingShipmentId(null)
    }
  }

  const handleSyncToOmg = async (shipmentId: number, poNumber?: string | null) => {
    if (!poNumber) {
      alert('This shipment has no PO number. Cannot sync to OMG.')
      return
    }
    
    setSyncingToOmgId(shipmentId)
    try {
      const result = await api.shipments.syncToOmg({ shipmentId })
      if (result.success) {
        // Show success with link to OMG if available
        if (result.omgUrls) {
          const viewInOmg = confirm(`✅ ${result.message}\n\nWould you like to open this PO in OMG?`)
          if (viewInOmg) {
            window.open(result.omgUrls.purchaseOrder, '_blank')
          }
        } else {
          alert(`✅ ${result.message}`)
        }
        // Refresh to show the OMG link in the table
        router.refresh()
      } else {
        alert(`⚠️ ${result.message}`)
      }
    } catch (error) {
      console.error('Failed to sync to OMG:', error)
      alert('Failed to sync to OMG. Check console for details.')
    } finally {
      setSyncingToOmgId(null)
    }
  }

  const handleCopyTracking = useCallback(async (trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopiedTracking(trackingNumber)
      setTimeout(() => setCopiedTracking(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [])

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500'
      case 'in_transit': return 'bg-blue-500'
      case 'out_for_delivery': return 'bg-purple-500'
      case 'exception': return 'bg-red-500'
      case 'pending': return 'bg-gray-500'
      default: return 'bg-yellow-500'
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), 'MMM d, yyyy')
    } catch {
      return null
    }
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), 'MMM d, h:mm a')
    } catch {
      return null
    }
  }

  const getLatestEvent = (events?: TrackingEvent[]) => {
    if (!events || events.length === 0) return null
    return events[0]
  }

  const getExpectedDelivery = (shipment: Shipment) => {
    if (!shipment.estimatedDelivery) {
      return null
    }
    return {
      date: formatDate(shipment.estimatedDelivery),
      source: 'carrier' as const,
    }
  }


  const getCarrierTrackingUrl = (carrier?: string | null, trackingNumber?: string) => {
    if (!trackingNumber) return null
    const normalized = (carrier || '').toLowerCase()

    switch (normalized) {
      case 'ups':
        return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(trackingNumber)}`
      case 'usps':
      case 'us-post':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
      case 'fedex':
        return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
      case 'dhl':
        return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`
      case 'lasership':
        return `https://www.lasership.com/track/${encodeURIComponent(trackingNumber)}`
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(trackingNumber)}+tracking`
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    }
    return sortDir === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />
  }

  const hasActiveFilters = searchInput || sortField

  return (
    <div className="space-y-4">
      {/* Search & Actions */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tracking, PO, or supplier..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <RefreshNow />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking Number</TableHead>
              <TableHead>PO / Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort('shippedDate')}>
                  Shipped
                  {getSortIcon('shippedDate')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort('estimatedDelivery')}>
                  Expected
                  {getSortIcon('estimatedDelivery')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort('deliveredDate')}>
                  Delivered
                  {getSortIcon('deliveredDate')}
                </Button>
              </TableHead>
              <TableHead>Latest Update</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => {
                const latestEvent = getLatestEvent(shipment.trackingEvents)
                const shippedDate = formatDate(shipment.shippedDate)
                const expectedInfo = getExpectedDelivery(shipment)
                const deliveredDate = formatDateTime(shipment.deliveredDate)
                const trackingUrl = getCarrierTrackingUrl(shipment.carrier, shipment.trackingNumber)

                return (
                  <TableRow key={shipment.id}>
                    {/* Tracking Number */}
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
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted"
                              aria-label={`Open ${shipment.carrier || 'carrier'} tracking page for ${shipment.trackingNumber}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground uppercase">
                          {shipment.carrier || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>

                    {/* PO / Supplier */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {shipment.supplier && <span className="text-sm">{shipment.supplier}</span>}
                        {shipment.poNumber && <span className="text-xs text-muted-foreground">PO: {shipment.poNumber}</span>}
                        {!shipment.supplier && !shipment.poNumber && <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status.replace('_', ' ')}
                        </Badge>
                        {shipment.ship24Status && shipment.ship24Status !== shipment.status && (
                          <span className="text-xs text-muted-foreground">{shipment.ship24Status}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Shipped */}
                    <TableCell>
                      {shippedDate ? (
                        <span className="text-sm">{shippedDate}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Expected */}
                    <TableCell>
                      {expectedInfo ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <TruckIcon className="h-3.5 w-3.5 text-orange-500" />
                          <span>{expectedInfo.date}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Delivered */}
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

                    {/* Latest Update */}
                    <TableCell>
                      {shipment.lastError ? (
                        <div className="flex flex-col gap-1 max-w-[250px]">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button 
                                type="button"
                                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
                                aria-label="View error details"
                              >
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">Tracking Error</span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-sm">
                              <div className="space-y-3">
                                <p className="font-medium text-red-600">Error Details</p>
                                <p className="text-muted-foreground break-words whitespace-pre-wrap text-xs">
                                  {shipment.lastError}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => handleRefreshShipment(shipment.id)}
                                  disabled={refreshingShipmentId === shipment.id}
                                >
                                  {refreshingShipmentId === shipment.id ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                      Retrying...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                      Retry Now
                                    </>
                                  )}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          {shipment.lastChecked && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      ) : latestEvent ? (
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

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={refreshingShipmentId === shipment.id || deletingShipmentId === shipment.id || syncingToOmgId === shipment.id}
                          >
                            {(refreshingShipmentId === shipment.id || deletingShipmentId === shipment.id || syncingToOmgId === shipment.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {shipment.lastError && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRefreshShipment(shipment.id)}
                                disabled={refreshingShipmentId === shipment.id}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry Tracking
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleSyncToOmg(shipment.id, shipment.poNumber)}
                            disabled={syncingToOmgId === shipment.id || !shipment.poNumber}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Sync to OMG
                            {!shipment.poNumber && <span className="ml-1 text-xs text-muted-foreground">(no PO)</span>}
                          </DropdownMenuItem>
                          {shipment.omgData && (
                            <DropdownMenuItem asChild>
                              <a
                                href={shipment.omgData.poUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View in OMG
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteShipment(shipment.id)}
                            disabled={deletingShipmentId === shipment.id}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} shipments
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
