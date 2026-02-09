'use client'

import { useState } from 'react'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { shipmentSchema, type ShipmentInput } from '@/lib/validations'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface AddShipmentFormProps {
  onSuccess: () => void
}

export default function AddShipmentForm({ onSuccess }: AddShipmentFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ShipmentInput>({
    trackingNumber: '',
    carrier: "other",
    poNumber: '',
    supplier: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const validated = shipmentSchema.parse(formData)

      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      })

      const _data: unknown = await response.json()

      if (!response.ok) {
        throw new Error(
          _data && typeof _data === 'object' && 'error' in _data
            ? String(_data.error)
            : 'Failed to add shipment'
        )
      }

      toast.success('Shipment added successfully')
      setFormData({
        trackingNumber: '',
        carrier: "other",
        poNumber: '',
        supplier: '',
      })
      setOpen(false)
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Shipment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Shipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="trackingNumber">Tracking Number *</Label>
            <Input
              id="trackingNumber"
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="carrier">Carrier</Label>
            <Select
              value={formData.carrier}
              onValueChange={(value) => setFormData({ ...formData, carrier: value as ShipmentInput['carrier'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ups">UPS</SelectItem>
                <SelectItem value="usps">USPS</SelectItem>
                <SelectItem value="fedex">FedEx</SelectItem>
                <SelectItem value="dhl">DHL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="poNumber">PO Number</Label>
            <Input
              id="poNumber"
              value={formData.poNumber}
              onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Shipment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
