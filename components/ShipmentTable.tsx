'use client'

import { useState, useEffect } from 'react'
import AddShipmentForm from './AddShipmentForm'
import SyncDialog from './SyncDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Shipment = {
  id: number
  poNumber: string
  trackingNumber: string
  carrier: string | null
  supplier: string | null
  status: string
  shippedDate: string | null
  estimatedDelivery: string | null
  deliveredDate: string | null
  lastChecked: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  in_transit: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  out_for_delivery: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  delivered: 'bg-green-100 text-green-800 hover:bg-green-100',
  exception: 'bg-red-100 text-red-800 hover:bg-red-100',
  failed_attempt: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
}

const CARRIER_URLS: Record<string, (tracking: string) => string> = {
  ups: (tracking) => `https://www.ups.com/track?tracknum=${tracking}`,
  usps: (tracking) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`,
  fedex: (tracking) => `https://www.fedex.com/fedextrack/?trknbr=${tracking}`,
  dhl: (tracking) => `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`,
}

export default function ShipmentTable() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchShipments()
  }, [])

  const fetchShipments = async () => {
    try {
      const res = await fetch('/api/shipments')
      const data = await res.json()
      setShipments(data)
    } catch (error) {
      console.error('Failed to fetch shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredShipments = shipments.filter((s) => {
    const matchesFilter = filter === 'all' || s.status === filter
    const matchesSearch =
      (s.poNumber && s.poNumber.toLowerCase().includes(search.toLowerCase())) ||
      s.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      (s.supplier && s.supplier.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const getCarrierUrl = (carrier: string | null, tracking: string) => {
    if (!carrier) return null
    const urlFn = CARRIER_URLS[carrier.toLowerCase()]
    return urlFn ? urlFn(tracking) : null
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Loading shipments...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Shipments</CardTitle>
          <CardDescription>
            Search by PO number, tracking number, or supplier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Input
              type="text"
              placeholder="Search PO#, Tracking#, or Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="exception">Exception</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchShipments} variant="outline">
              Refresh
            </Button>
            <SyncDialog onSuccess={fetchShipments} />
            <AddShipmentForm onSuccess={fetchShipments} />
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Shipments</CardTitle>
          <CardDescription>
            Showing {filteredShipments.length} of {shipments.length} shipments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipped</TableHead>
                  <TableHead>Est. Delivery</TableHead>
                  <TableHead>Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                      {search || filter !== 'all' 
                        ? 'No shipments match your filters'
                        : 'No shipments found. Click "Sync Front Inbox" or "Add Shipment" to get started.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShipments.map((shipment) => {
                    const trackingUrl = getCarrierUrl(shipment.carrier, shipment.trackingNumber)
                    return (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.poNumber}</TableCell>
                        <TableCell>
                          {trackingUrl ? (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {shipment.trackingNumber}
                            </a>
                          ) : (
                            shipment.trackingNumber
                          )}
                        </TableCell>
                        <TableCell className="uppercase">
                          {shipment.carrier || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shipment.supplier || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={STATUS_COLORS[shipment.status] || STATUS_COLORS.pending}
                          >
                            {shipment.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(shipment.shippedDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(shipment.estimatedDelivery)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(shipment.deliveredDate)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
