'use client'

import React, { useState, useCallback } from 'react'
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
import {
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Upload,
  Package,
  Truck,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
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
  orderNumber: string // Human-readable order number (e.g., "164")
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse PO number to extract order number for OMG link
 * Format: "164-1" → orderNumber: "164"
 */
function parseOrderNumber(poNumber: string | null | undefined): string | null {
  if (!poNumber) return null
  const match = poNumber.match(/^(\d+)-\d+$/)
  return match ? match[1] : null
}

/**
 * Generate OMG order URL from PO number
 */
function getOmgOrderUrl(poNumber: string | null | undefined): string | null {
  const orderNumber = parseOrderNumber(poNumber)
  if (!orderNumber) return null
  // OMG uses order number in the URL path
  return `https://stitchi.omgorders.app/orders?search=${encodeURIComponent(orderNumber)}`
}

/**
 * Generate carrier tracking URL
 */
function getCarrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string | null {
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

/**
 * Get status badge styling
 */
function getStatusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'delivered':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' }
    case 'in_transit':
      return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' }
    case 'out_for_delivery':
      return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' }
    case 'exception':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' }
    case 'pending':
      return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' }
    default:
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' }
  }
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return format(new Date(dateStr), 'MMM d')
  } catch {
    return null
  }
}

/**
 * Format date with time
 */
function formatDateTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return format(new Date(dateStr), 'MMM d, h:mm a')
  } catch {
    return null
  }
}

// ============================================================================
// Component
// ============================================================================

export default function ShipmentTable({
  shipments,
  pagination,
  // activeStatus reserved for future status-specific styling
}: ShipmentTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Local state
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
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

  const toggleRowExpanded = useCallback((id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

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
            placeholder="Search tracking, PO, or supplier…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
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
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 -ml-2"
                  onClick={() => handleSort('shippedDate')}
                >
                  Status
                  {getSortIcon('shippedDate')}
                </Button>
              </TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => {
                const isExpanded = expandedRows.has(shipment.id)
                const omgUrl = getOmgOrderUrl(shipment.poNumber)
                const trackingUrl = getCarrierTrackingUrl(shipment.carrier, shipment.trackingNumber)
                const statusStyle = getStatusStyle(shipment.status)
                const latestEvent = shipment.trackingEvents?.[0]
                const isLoading = refreshingShipmentId === shipment.id ||
                  deletingShipmentId === shipment.id ||
                  syncingToOmgId === shipment.id

                // Determine which date to show based on status
                let dateInfo: { label: string; value: string | null; icon: React.ReactNode } | null = null
                if (shipment.status === 'delivered' && shipment.deliveredDate) {
                  dateInfo = {
                    label: 'Delivered',
                    value: formatDate(shipment.deliveredDate),
                    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
                  }
                } else if (shipment.estimatedDelivery) {
                  dateInfo = {
                    label: 'Expected',
                    value: formatDate(shipment.estimatedDelivery),
                    icon: <Truck className="h-3.5 w-3.5 text-orange-500" />,
                  }
                } else if (shipment.shippedDate) {
                  dateInfo = {
                    label: 'Shipped',
                    value: formatDate(shipment.shippedDate),
                    icon: <Package className="h-3.5 w-3.5 text-blue-500" />,
                  }
                }

                return (
                  <React.Fragment key={shipment.id}>
                    <TableRow
                        className={cn(
                          'group',
                          isExpanded && 'bg-muted/50',
                          shipment.lastError && 'bg-red-50 dark:bg-red-950/20'
                        )}
                      >
                        {/* Expand Toggle */}
                        <TableCell className="pr-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleRowExpanded(shipment.id)}
                            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                            />
                          </Button>
                        </TableCell>

                        {/* Order Info */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            {shipment.omgData ? (
                              // Synced OMG data - show order number linked to order, PO linked to PO page
                              <>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={shipment.omgData.orderUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="font-medium text-primary hover:underline"
                                    title={shipment.omgData.orderName || `Order ${shipment.omgData.orderNumber}`}
                                  >
                                    Order {shipment.omgData.orderNumber}
                                  </a>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                                </div>
                                {shipment.poNumber && (
                                  <a
                                    href={shipment.omgData.poUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                  >
                                    PO {shipment.poNumber}
                                  </a>
                                )}
                              </>
                            ) : shipment.poNumber ? (
                              // No OMG data synced - show PO with fallback search link
                              <div className="flex items-center gap-1.5">
                                {omgUrl ? (
                                  <a
                                    href={omgUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="font-medium text-primary hover:underline truncate"
                                    title={`Search Order ${parseOrderNumber(shipment.poNumber)} in OMG`}
                                  >
                                    PO {shipment.poNumber}
                                  </a>
                                ) : (
                                  <span className="font-medium truncate">
                                    PO {shipment.poNumber}
                                  </span>
                                )}
                                {omgUrl && (
                                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No PO</span>
                            )}
                            {shipment.supplier && (
                              <span className="text-xs text-muted-foreground truncate">
                                {shipment.supplier}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Tracking */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {shipment.trackingNumber}
                              </span>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyTracking(shipment.trackingNumber)}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
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
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={`Track on ${shipment.carrier || 'carrier'} website`}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground uppercase">
                              {shipment.carrier || 'Unknown carrier'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="secondary"
                              className={cn('w-fit', statusStyle.bg, statusStyle.text)}
                            >
                              {formatStatus(shipment.status)}
                            </Badge>
                            {dateInfo && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {dateInfo.icon}
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {dateInfo.value}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Last Update */}
                        <TableCell>
                          {shipment.lastError ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
                                  aria-label="View error details"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="font-medium">Error</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm">
                                <div className="space-y-3">
                                  <p className="font-medium text-red-600">Tracking Error</p>
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
                                        Retrying…
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
                          ) : latestEvent ? (
                            <div className="flex flex-col gap-0.5 max-w-[200px]">
                              {latestEvent.location && (
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                                  <span className="truncate">{latestEvent.location}</span>
                                </div>
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
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              Never checked
                            </span>
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
                                disabled={isLoading}
                              >
                                {isLoading ? (
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
                                {!shipment.poNumber && (
                                  <span className="ml-1 text-xs text-muted-foreground">(no PO)</span>
                                )}
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

                      {/* Expanded Details */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pl-10">
                              {/* Dates */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Shipped
                                </p>
                                <p style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {formatDateTime(shipment.shippedDate) || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Expected
                                </p>
                                <p style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {formatDateTime(shipment.estimatedDelivery) || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Delivered
                                </p>
                                <p style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {formatDateTime(shipment.deliveredDate) || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Last Checked
                                </p>
                                <p>
                                  {shipment.lastChecked
                                    ? formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })
                                    : '—'}
                                </p>
                              </div>

                              {/* Tracking Events */}
                              {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
                                <div className="col-span-2 md:col-span-4 mt-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                    Recent Events
                                  </p>
                                  <div className="space-y-2">
                                    {shipment.trackingEvents.slice(0, 5).map((event) => (
                                      <div
                                        key={event.id}
                                        className="flex items-start gap-2 text-sm"
                                      >
                                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            {event.location && (
                                              <span className="truncate">{event.location}</span>
                                            )}
                                            {event.eventTime && (
                                              <span className="text-xs text-muted-foreground flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {format(new Date(event.eventTime), 'MMM d, h:mm a')}
                                              </span>
                                            )}
                                          </div>
                                          {event.message && (
                                            <p className="text-muted-foreground truncate">
                                              {event.message}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} shipments
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <span className="text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
