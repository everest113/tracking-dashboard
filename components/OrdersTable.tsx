'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  Package,
  Truck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  MessageSquare,
  PackageCheck,
  CircleDot,
  RefreshCw,
  Pencil,
  Link2,
  Search,
  X,
  Loader2,
  Factory,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { api } from '@/lib/orpc/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import RefreshNow from '@/components/RefreshNow'

// Order-level status (matches server-side enum)
type OrderStatus = 'all' | 'pending' | 'in_transit' | 'partially_delivered' | 'delivered' | 'exception'

// API status type (excludes 'all')
type ApiOrderStatus = Exclude<OrderStatus, 'all'>

interface Shipment {
  id: number
  trackingNumber: string
  carrier: string | null
  status: string
  shippedDate: string | null
  deliveredDate: string | null
  lastChecked: string | null
}

interface PurchaseOrder {
  poNumber: string
  supplierName: string | null
  shipDate: string | null
  inHandsDate: string | null
  operationsStatus: string | null
  shipments: Shipment[]
}

interface Order {
  orderNumber: string
  orderName: string | null
  customerName: string | null
  customerEmail: string | null
  omgOrderUrl: string
  computedStatus: ApiOrderStatus
  threadStatus: 'linked' | 'pending' | 'not_found' | 'none'
  frontConversationId: string | null
  // OMG status fields
  omgApprovalStatus: string | null
  omgOperationsStatus: string | null
  poCount: number
  lastSyncedAt: string | null
  // Purchase Orders with shipments
  purchaseOrders: PurchaseOrder[]
  stats: {
    total: number
    delivered: number
    inTransit: number
    pending: number
    exception: number
  }
}

interface StatusCounts {
  all: number
  pending: number
  in_transit: number
  partially_delivered: number
  delivered: number
  exception: number
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('') // Debounced input
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('all')
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    pending: 0,
    in_transit: 0,
    partially_delivered: 0,
    delivered: 0,
    exception: 0,
  })
  const [total, setTotal] = useState(0)
  
  // Thread management state
  const [threadPopoverOpen, setThreadPopoverOpen] = useState<string | null>(null)
  const [threadLoading, setThreadLoading] = useState<string | null>(null)
  const [manualConversationId, setManualConversationId] = useState('')
  
  // Refresh state
  const [refreshingOrder, setRefreshingOrder] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch orders when filters change
  useEffect(() => {
    fetchOrders()
  }, [activeStatus, searchQuery])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.orders.list({
        status: activeStatus === 'all' ? undefined : activeStatus as ApiOrderStatus,
        search: searchQuery || undefined,
        limit: 100,
      })
      setOrders(result.orders as Order[])
      setTotal(result.total)
      setStatusCounts(result.statusCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, searchQuery])

  const toggleExpanded = (orderNumber: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderNumber)) {
        next.delete(orderNumber)
      } else {
        next.add(orderNumber)
      }
      return next
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700">Delivered</Badge>
      case 'in_transit':
        return <Badge className="bg-blue-100 text-blue-700">In Transit</Badge>
      case 'out_for_delivery':
        return <Badge className="bg-purple-100 text-purple-700">Out for Delivery</Badge>
      case 'exception':
        return <Badge className="bg-red-100 text-red-700">Exception</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Smart status - shows the most relevant status for where the order is
  const getOrderStatus = (order: Order) => {
    const { computedStatus, stats, omgOperationsStatus } = order
    
    // Exception always takes priority
    if (computedStatus === 'exception') {
      return { label: 'Exception', color: 'bg-red-100 text-red-700', icon: AlertCircle }
    }
    
    // If we have shipments, show delivery status
    if (stats.total > 0) {
      switch (computedStatus) {
        case 'delivered':
          return { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle2 }
        case 'partially_delivered':
          return { label: `${stats.delivered}/${stats.total} Delivered`, color: 'bg-green-100 text-green-700', icon: CheckCircle2 }
        case 'in_transit':
          return { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: Truck }
        case 'pending':
          return { label: 'Tracking Pending', color: 'bg-gray-100 text-gray-600', icon: Clock }
      }
    }
    
    // No shipments yet - show production status from OMG
    if (omgOperationsStatus) {
      return { label: omgOperationsStatus, color: 'bg-amber-50 text-amber-700', icon: Factory }
    }
    
    // Fallback
    return { label: 'Awaiting Info', color: 'bg-gray-100 text-gray-500', icon: Clock }
  }

  // Thread management functions
  const handleRefreshThread = async (orderNumber: string) => {
    setThreadLoading(orderNumber)
    try {
      const result = await api.customerThread.triggerDiscovery({ orderNumber })
      
      if (result.status === 'linked' || result.status === 'already_linked') {
        toast.success('Thread linked!', {
          description: result.threadLink?.conversationSubject || `Matched with ${Math.round((result.topScore ?? 0) * 100)}% confidence`,
          action: result.threadLink?.frontConversationId ? {
            label: 'Open in Front',
            onClick: () => window.open(`https://app.frontapp.com/open/${result.threadLink!.frontConversationId}`, '_blank'),
          } : undefined,
        })
        fetchOrders() // Refresh to show updated thread status
        setThreadPopoverOpen(null)
      } else if (result.status === 'pending_review') {
        toast.info('Needs review', {
          description: `Found ${result.candidatesFound} candidate(s) - review or enter ID manually`,
        })
        fetchOrders()
      } else {
        toast.warning('No thread found', {
          description: result.reason || 'Enter a conversation ID manually',
        })
      }
    } catch (err) {
      toast.error('Discovery failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setThreadLoading(null)
    }
  }

  const handleLinkThread = async (orderNumber: string, conversationId: string) => {
    if (!conversationId.trim()) return
    
    // Clean up the conversation ID
    let cleanId = conversationId.trim()
    // Extract cnv_ ID if user pasted a Front URL
    const urlMatch = cleanId.match(/cnv_[a-z0-9]+/i)
    if (urlMatch) {
      cleanId = urlMatch[0]
    }
    
    if (!cleanId.startsWith('cnv_')) {
      toast.error('Invalid conversation ID', {
        description: 'ID should start with "cnv_" (e.g., cnv_abc123)',
      })
      return
    }
    
    setThreadLoading(orderNumber)
    try {
      await api.customerThread.linkDifferent({
        orderNumber,
        newConversationId: cleanId,
      })
      toast.success('Thread linked!', {
        action: {
          label: 'Open in Front',
          onClick: () => window.open(`https://app.frontapp.com/open/${cleanId}`, '_blank'),
        },
      })
      fetchOrders()
      setThreadPopoverOpen(null)
      setManualConversationId('')
    } catch (err) {
      toast.error('Failed to link thread', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setThreadLoading(null)
    }
  }

  // Refresh single order from OMG
  const handleRefreshOrder = async (orderNumber: string) => {
    setRefreshingOrder(orderNumber)
    try {
      const result = await api.orders.refreshOne({ orderNumber })
      
      if (result.success) {
        toast.success('Order refreshed', {
          description: `${result.shipmentCount} shipment(s), status: ${result.computedStatus}`,
        })
        fetchOrders() // Refresh the list
      } else {
        toast.error('Refresh failed', {
          description: result.error || 'Unknown error',
        })
      }
    } catch (err) {
      toast.error('Refresh failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setRefreshingOrder(null)
    }
  }

  // Status tab configuration
  const statusTabs: Array<{ key: OrderStatus; label: string; icon?: React.ReactNode }> = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'in_transit', label: 'In Transit', icon: <Truck className="h-3.5 w-3.5" /> },
    { key: 'partially_delivered', label: 'Partial', icon: <CircleDot className="h-3.5 w-3.5" /> },
    { key: 'delivered', label: 'Delivered', icon: <PackageCheck className="h-3.5 w-3.5" /> },
    { key: 'exception', label: 'Exception', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchOrders}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto pb-px">
        {statusTabs.map((tab) => {
          const count = statusCounts[tab.key]
          const isActive = activeStatus === tab.key
          
          return (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={cn(
                'ml-1 text-xs',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* Search & Refresh */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search orders, customers..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
        <RefreshNow />
        <div className="ml-auto text-sm text-muted-foreground">
          {loading ? '...' : `${orders.length} of ${total}`} order{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Orders List */}
      <div className="border rounded-lg">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No orders found
          </div>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedOrders.has(order.orderNumber)
            
            return (
              <Collapsible key={order.orderNumber} open={isExpanded}>
                <div className={cn(
                  'border-b last:border-b-0',
                  isExpanded && 'bg-muted/30'
                )}>
                  {/* Order Header */}
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleExpanded(order.orderNumber)}
                    >
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      
                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {order.orderName || `Order #${order.orderNumber}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customerName || `#${order.orderNumber}`}
                        </div>
                      </div>

                      {/* Status Badge */}
                      {(() => {
                        const status = getOrderStatus(order)
                        const StatusIcon = status.icon
                        return (
                          <Badge className={cn("gap-1 whitespace-nowrap", status.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        )
                      })()}

                      {/* Shipment Progress */}
                      {order.stats.total > 0 ? (
                        <div className="text-sm text-muted-foreground whitespace-nowrap" title={`${order.stats.delivered} of ${order.stats.total} delivered`}>
                          {order.stats.delivered}/{order.stats.total}
                        </div>
                      ) : order.poCount > 0 ? (
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {order.poCount} PO{order.poCount !== 1 ? 's' : ''}
                        </div>
                      ) : null}
                        
                        {/* Thread indicator with popover */}
                        <Popover 
                          open={threadPopoverOpen === order.orderNumber} 
                          onOpenChange={(open) => {
                            setThreadPopoverOpen(open ? order.orderNumber : null)
                            if (!open) setManualConversationId('')
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
                                order.frontConversationId 
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
                              )}
                              onClick={(e) => e.stopPropagation()}
                              title={order.frontConversationId ? 'Conversation linked' : 'No conversation - click to link'}
                            >
                              <MessageSquare className={cn(
                                "h-4 w-4",
                                !order.frontConversationId && "opacity-40"
                              )} />
                              {order.frontConversationId && (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-80" 
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-3">
                              <div className="font-medium text-sm">Customer Conversation</div>
                              
                              {/* Show conversation link if we have one */}
                              {order.frontConversationId ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Linked</span>
                                  </div>
                                  <a
                                    href={`https://app.frontapp.com/open/${order.frontConversationId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Open in Front
                                  </a>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {order.frontConversationId}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>No conversation linked</span>
                                </div>
                              )}
                              
                              <div className="border-t pt-3 space-y-2">
                                {/* Refresh/discover button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => handleRefreshThread(order.orderNumber)}
                                  disabled={threadLoading === order.orderNumber}
                                >
                                  {threadLoading === order.orderNumber ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  {order.threadStatus === 'none' || order.threadStatus === 'not_found' 
                                    ? 'Search for thread' 
                                    : 'Re-discover thread'}
                                </Button>
                                
                                {/* Manual link input */}
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Or enter conversation ID manually:
                                  </label>
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="cnv_abc123..."
                                      value={manualConversationId}
                                      onChange={(e) => setManualConversationId(e.target.value)}
                                      className="h-8 text-sm font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleLinkThread(order.orderNumber, manualConversationId)
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleLinkThread(order.orderNumber, manualConversationId)}
                                      disabled={!manualConversationId.trim() || threadLoading === order.orderNumber}
                                    >
                                      <Link2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                    </button>
                  </CollapsibleTrigger>

                  {/* Purchase Orders Table */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Carrier</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Update</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.purchaseOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                                No purchase orders
                              </TableCell>
                            </TableRow>
                          ) : (
                            order.purchaseOrders.map((po) => {
                              // If PO has shipments, show one row per shipment
                              if (po.shipments.length > 0) {
                                return po.shipments.map((shipment, idx) => (
                                  <TableRow key={`${po.poNumber}-${shipment.id}`}>
                                    <TableCell className="font-mono text-sm">
                                      {idx === 0 ? po.poNumber : ''}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {idx === 0 ? (po.supplierName || '—') : ''}
                                    </TableCell>
                                    <TableCell>
                                      <a
                                        href={`https://www.google.com/search?q=${encodeURIComponent(shipment.trackingNumber)}+tracking`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                                      >
                                        {shipment.trackingNumber}
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground uppercase">
                                      {shipment.carrier || '—'}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(shipment.status)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {shipment.lastChecked ? (
                                        formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              }
                              
                              // PO with no shipments - show empty row
                              return (
                                <TableRow key={po.poNumber} className="bg-muted/30">
                                  <TableCell className="font-mono text-sm">
                                    {po.poNumber}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {po.supplierName || '—'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground italic">
                                    No tracking yet
                                  </TableCell>
                                  <TableCell>—</TableCell>
                                  <TableCell>
                                    {po.operationsStatus ? (
                                      <Badge variant="outline" className="text-xs">
                                        {po.operationsStatus}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">Awaiting</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {po.shipDate ? (
                                      <span title="Ship date">
                                        Ships {formatDistanceToNow(new Date(po.shipDate), { addSuffix: true })}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })
        )}
      </div>
    </div>
  )
}
