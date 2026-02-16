'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { api } from '@/lib/orpc/client'
import { cn } from '@/lib/utils'
import RefreshNow from '@/components/RefreshNow'

// Order-level status derived from shipment stats
type OrderStatus = 'all' | 'delivered' | 'partially_delivered' | 'in_transit' | 'exception' | 'pending'

/**
 * Derive order-level status from shipment stats
 */
function getOrderStatus(stats: Order['stats']): Exclude<OrderStatus, 'all'> {
  // Exception takes priority - needs attention
  if (stats.exception > 0) return 'exception'
  // All delivered
  if (stats.delivered === stats.total && stats.total > 0) return 'delivered'
  // Some delivered
  if (stats.delivered > 0) return 'partially_delivered'
  // Any in transit
  if (stats.inTransit > 0) return 'in_transit'
  // Default to pending
  return 'pending'
}

interface Shipment {
  id: number
  poNumber: string | null
  trackingNumber: string
  carrier: string | null
  status: string
  shippedDate: string | null
  deliveredDate: string | null
  lastChecked: string | null
  threadStatus: 'linked' | 'pending' | 'not_found' | 'none'
}

interface Order {
  orderNumber: string
  orderName: string | null
  customerName: string | null
  customerEmail: string | null
  omgOrderUrl: string
  shipments: Shipment[]
  stats: {
    total: number
    delivered: number
    inTransit: number
    pending: number
    exception: number
  }
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('all')

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.orders.list({})
      setOrders(result.orders)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  // Compute status counts for tabs
  const statusCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      delivered: 0,
      partially_delivered: 0,
      in_transit: 0,
      exception: 0,
      pending: 0,
    }
    
    for (const order of orders) {
      const status = getOrderStatus(order.stats)
      counts[status]++
    }
    
    return counts
  }, [orders])

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

  const getOrderStatusBadge = (stats: Order['stats']) => {
    const status = getOrderStatus(stats)
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700">Delivered</Badge>
      case 'partially_delivered':
        return <Badge className="bg-blue-100 text-blue-700">{stats.delivered}/{stats.total} Delivered</Badge>
      case 'in_transit':
        return <Badge className="bg-purple-100 text-purple-700">In Transit</Badge>
      case 'exception':
        return <Badge className="bg-red-100 text-red-700">Exception</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getThreadStatusIcon = (status: string) => {
    switch (status) {
      case 'linked':
        return <span title="Thread linked"><MessageSquare className="h-4 w-4 text-green-600" /></span>
      case 'pending':
        return <span title="Thread pending review"><MessageSquare className="h-4 w-4 text-yellow-600" /></span>
      case 'not_found':
        return <span title="No thread found"><MessageSquare className="h-4 w-4 text-gray-400" /></span>
      default:
        return null
    }
  }

  // Filter orders by search query and status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (activeStatus !== 'all') {
        const orderStatus = getOrderStatus(order.stats)
        if (orderStatus !== activeStatus) return false
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          order.orderName?.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.customerEmail?.toLowerCase().includes(query)
        )
      }
      
      return true
    })
  }, [orders, activeStatus, searchQuery])

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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <RefreshNow />
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Orders List */}
      <div className="border rounded-lg">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No orders found
          </div>
        ) : (
          filteredOrders.map((order) => {
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
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {order.orderName || `Order #${order.orderNumber}`}
                          </span>
                          <span className="text-muted-foreground">
                            #{order.orderNumber}
                          </span>
                          {getOrderStatusBadge(order.stats)}
                          <a
                            href={order.omgOrderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                          {order.customerName && (
                            <span>{order.customerName}</span>
                          )}
                          {order.customerEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {order.customerEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1" title="Total shipments">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{order.stats.total}</span>
                        </div>
                        {order.stats.delivered > 0 && (
                          <div className="flex items-center gap-1 text-green-600" title="Delivered">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{order.stats.delivered}</span>
                          </div>
                        )}
                        {order.stats.inTransit > 0 && (
                          <div className="flex items-center gap-1 text-blue-600" title="In transit">
                            <Truck className="h-4 w-4" />
                            <span>{order.stats.inTransit}</span>
                          </div>
                        )}
                        {order.stats.exception > 0 && (
                          <div className="flex items-center gap-1 text-red-600" title="Exception">
                            <AlertCircle className="h-4 w-4" />
                            <span>{order.stats.exception}</span>
                          </div>
                        )}
                        {order.stats.pending > 0 && (
                          <div className="flex items-center gap-1 text-gray-500" title="Pending">
                            <Clock className="h-4 w-4" />
                            <span>{order.stats.pending}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  {/* Shipments Table */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO</TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Carrier</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Thread</TableHead>
                            <TableHead>Last Update</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.shipments.map((shipment) => (
                            <TableRow key={shipment.id}>
                              <TableCell className="font-mono text-sm">
                                {shipment.poNumber || '—'}
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
                              <TableCell>
                                {getThreadStatusIcon(shipment.threadStatus)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {shipment.lastChecked ? (
                                  formatDistanceToNow(new Date(shipment.lastChecked), { addSuffix: true })
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
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
