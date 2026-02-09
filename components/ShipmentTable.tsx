'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Shipment {
  id: number
  tracking_number: string
  carrier: string | null
  status: string
  po_number: string | null
  supplier: string | null
  last_checked: string | null
  created_at: string
}

export default function ShipmentTable({ shipments }: { shipments: Shipment[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = shipments.filter((shipment) => {
    const matchesSearch =
      search === '' ||
      shipment.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      shipment.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      shipment.supplier?.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter

    return matchesSearch && matchesStatus
  })

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

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search tracking #, PO, or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking Number</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono">{shipment.tracking_number}</TableCell>
                  <TableCell>{shipment.po_number || '-'}</TableCell>
                  <TableCell>{shipment.supplier || '-'}</TableCell>
                  <TableCell className="uppercase">{shipment.carrier || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(shipment.status)}>
                      {shipment.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shipment.last_checked
                      ? formatDistanceToNow(new Date(shipment.last_checked), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {shipments.length} shipments
      </div>
    </div>
  )
}
