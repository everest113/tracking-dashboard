'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
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
  Link2,
  Loader2,
  Factory,
  Package,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/orpc/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import RefreshNow from '@/components/RefreshNow'

// Order-level status (matches server-side enum)
type OrderStatus = 'all' | 'pending' | 'in_transit' | 'partially_delivered' | 'delivered' | 'exception'
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
  omgApprovalStatus: string | null
  omgOperationsStatus: string | null
  inHandsDate: string | null
  poCount: number
  lastSyncedAt: string | null
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
  const [searchInput, setSearchInput] = useState('')
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
    const timer = setTimeout(() => setSearchQuery(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

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

  // Get single smart status for an order
  // Priority: Exception > Delivery status (if shipped) > Production status
  const getSmartStatus = (order: Order): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType } => {
    // Exception takes priority
    if (order.stats.exception > 0) {
      return { label: 'Exception', variant: 'destructive', icon: AlertCircle }
    }
    
    // If we have tracking, show delivery status
    if (order.stats.total > 0) {
      if (order.stats.delivered === order.stats.total) {
        return { label: 'Delivered', variant: 'default', icon: PackageCheck }
      }
      if (order.stats.delivered > 0) {
        return { label: 'Partial', variant: 'secondary', icon: CircleDot }
      }
      if (order.stats.inTransit > 0) {
        return { label: 'In Transit', variant: 'secondary', icon: Truck }
      }
      return { label: 'Pending', variant: 'outline', icon: Clock }
    }
    
    // No tracking - show production status
    if (order.omgOperationsStatus) {
      return { label: order.omgOperationsStatus, variant: 'outline', icon: Factory }
    }
    
    return { label: 'No Status', variant: 'outline', icon: Package }
  }

  // Format in-hands date
  const formatInHandsDate = (dateStr: string | null): { text: string; isPast: boolean } | null => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const isPast = date < now
    const sameYear = date.getFullYear() === now.getFullYear()
    const text = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' })
    })
    return { text, isPast }
  }

  // Format tracking progress
  const formatTracking = (order: Order): string => {
    if (order.stats.total === 0) {
      return order.poCount > 0 ? `${order.poCount} PO${order.poCount !== 1 ? 's' : ''}` : '—'
    }
    return `${order.stats.delivered}/${order.stats.total}`
  }

  // Thread management functions
  const handleRefreshThread = async (orderNumber: string) => {
    setThreadLoading(orderNumber)
    try {
      const result = await api.customerThread.triggerDiscovery({ orderNumber })
      
      if (result.status === 'linked' || result.status === 'already_linked') {
        toast.success('Thread linked!', {
          description: result.threadLink?.conversationSubject || `Matched with ${Math.round((result.topScore ?? 0) * 100)}% confidence`,
        })
        fetchOrders()
        setThreadPopoverOpen(null)
      } else if (result.status === 'pending_review') {
        toast.info('Needs review', {
          description: `Found ${result.candidatesFound} candidate(s)`,
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
    
    let cleanId = conversationId.trim()
    const urlMatch = cleanId.match(/cnv_[a-z0-9]+/i)
    if (urlMatch) cleanId = urlMatch[0]
    
    if (!cleanId.startsWith('cnv_')) {
      toast.error('Invalid conversation ID', {
        description: 'ID should start with "cnv_"',
      })
      return
    }
    
    setThreadLoading(orderNumber)
    try {
      await api.customerThread.linkDifferent({
        orderNumber,
        newConversationId: cleanId,
      })
      toast.success('Thread linked!')
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

  const handleRefreshOrder = async (orderNumber: string) => {
    setRefreshingOrder(orderNumber)
    try {
      const result = await api.orders.refreshOne({ orderNumber })
      
      if (result.success) {
        toast.success('Order refreshed')
        fetchOrders()
      } else {
        toast.error('Refresh failed', { description: result.error })
      }
    } catch (err) {
      toast.error('Refresh failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setRefreshingOrder(null)
    }
  }

  // Status tabs
  const statusTabs: Array<{ key: OrderStatus; label: string; icon?: React.ReactNode }> = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'in_transit', label: 'In Transit', icon: <Truck className="h-3.5 w-3.5" /> },
    { key: 'partially_delivered', label: 'Partial', icon: <CircleDot className="h-3.5 w-3.5" /> },
    { key: 'delivered', label: 'Delivered', icon: <PackageCheck className="h-3.5 w-3.5" /> },
    { key: 'exception', label: 'Exception', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  ]

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
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
    <TooltipProvider>
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
            {orders.length} of {total} order{total !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Orders Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>In-Hands</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead className="w-10">Thread</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const isExpanded = expandedOrders.has(order.orderNumber)
                  const status = getSmartStatus(order)
                  const StatusIcon = status.icon
                  const inHands = formatInHandsDate(order.inHandsDate)
                  
                  return (
                    <Collapsible key={order.orderNumber} asChild open={isExpanded}>
                      <>
                        {/* Main Row */}
                        <TableRow 
                          className={cn(
                            'cursor-pointer hover:bg-muted/50',
                            isExpanded && 'bg-muted/30'
                          )}
                          onClick={() => toggleExpanded(order.orderNumber)}
                        >
                          <TableCell className="py-2">
                            <CollapsibleTrigger asChild>
                              <button className="p-1">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            </CollapsibleTrigger>
                          </TableCell>
                          
                          {/* Order */}
                          <TableCell className="py-2">
                            <div className="font-medium">
                              {order.orderName || `Order #${order.orderNumber}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              #{order.orderNumber}
                            </div>
                          </TableCell>
                          
                          {/* Customer */}
                          <TableCell className="py-2">
                            <div className="text-sm">
                              {order.customerName || '—'}
                            </div>
                            {order.customerEmail && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                    {order.customerEmail}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{order.customerEmail}</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          
                          {/* Status */}
                          <TableCell className="py-2">
                            <Badge variant={status.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          
                          {/* In-Hands */}
                          <TableCell className="py-2">
                            {inHands ? (
                              <span className={cn(
                                'text-sm',
                                inHands.isPast && 'text-red-600 font-medium'
                              )}>
                                {inHands.text}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          
                          {/* Tracking */}
                          <TableCell className="py-2">
                            <span className={cn(
                              'text-sm',
                              order.stats.total > 0 && order.stats.delivered === order.stats.total && 'text-green-600',
                              order.stats.total > 0 && order.stats.delivered < order.stats.total && 'text-blue-600',
                              order.stats.total === 0 && 'text-muted-foreground'
                            )}>
                              {formatTracking(order)}
                            </span>
                          </TableCell>
                          
                          {/* Thread */}
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
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
                                    'p-1 rounded transition-colors',
                                    order.frontConversationId 
                                      ? 'text-green-600 hover:bg-green-100'
                                      : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'
                                  )}
                                  title={order.frontConversationId ? 'Linked' : 'Not linked'}
                                >
                                  {order.frontConversationId ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <MessageSquare className="h-4 w-4" />
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72" align="end">
                                <div className="space-y-3">
                                  <div className="font-medium text-sm">Customer Thread</div>
                                  
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
                                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Open in Front
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      No conversation linked
                                    </div>
                                  )}
                                  
                                  <div className="border-t pt-3 space-y-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => handleRefreshThread(order.orderNumber)}
                                      disabled={threadLoading === order.orderNumber}
                                    >
                                      {threadLoading === order.orderNumber ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                      )}
                                      Search for thread
                                    </Button>
                                    
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="cnv_..."
                                        value={manualConversationId}
                                        onChange={(e) => setManualConversationId(e.target.value)}
                                        className="h-8 text-xs font-mono"
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
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          
                          {/* Actions */}
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={refreshingOrder === order.orderNumber}
                                    onClick={() => handleRefreshOrder(order.orderNumber)}
                                  >
                                    {refreshingOrder === order.orderNumber ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh from OMG</TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={order.omgOrderUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Open in OMG</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Content */}
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={8} className="p-0">
                              <div className="px-8 py-4 space-y-4">
                                {/* Customer Details */}
                                {order.customerEmail && (
                                  <div className="flex items-center gap-4 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={`mailto:${order.customerEmail}`}
                                      className="text-primary hover:underline"
                                    >
                                      {order.customerEmail}
                                    </a>
                                  </div>
                                )}
                                
                                {/* PO Details */}
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>PO</TableHead>
                                      <TableHead>Supplier</TableHead>
                                      <TableHead>Tracking</TableHead>
                                      <TableHead>Carrier</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Updated</TableHead>
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
                                      order.purchaseOrders.flatMap((po) => {
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
                                                  className="font-mono text-sm text-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                  {shipment.trackingNumber}
                                                  <ExternalLink className="h-3 w-3" />
                                                </a>
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground uppercase">
                                                {shipment.carrier || '—'}
                                              </TableCell>
                                              <TableCell>
                                                <Badge 
                                                  variant={
                                                    shipment.status === 'delivered' ? 'default' :
                                                    shipment.status === 'exception' ? 'destructive' :
                                                    'secondary'
                                                  }
                                                  className="text-xs"
                                                >
                                                  {shipment.status}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {shipment.lastChecked 
                                                  ? formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })
                                                  : '—'}
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        }
                                        
                                        return [(
                                          <TableRow key={po.poNumber} className="bg-muted/30">
                                            <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
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
                                            <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                          </TableRow>
                                        )]
                                      })
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
