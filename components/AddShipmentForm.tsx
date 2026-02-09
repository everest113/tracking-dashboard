'use client'

import { useState } from 'react'
import { shipmentSchema, type ShipmentInput } from '@/lib/validations'
import { ZodError } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/orpc/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FormErrors = {
  poNumber?: string
  trackingNumber?: string
  carrier?: string
  supplier?: string
  shippedDate?: string
  estimatedDelivery?: string
}

type AddShipmentFormProps = {
  onSuccess: () => void
}

export default function AddShipmentForm({ onSuccess }: AddShipmentFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  
  const [formData, setFormData] = useState<ShipmentInput>({
    poNumber: '',
    trackingNumber: '',
    carrier: 'ups',
    supplier: '',
    shippedDate: '',
    estimatedDelivery: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsSubmitting(true)

    try {
      // Validate with Zod on client-side
      const validatedData = shipmentSchema.parse(formData)

      // Call ORPC endpoint
      const data = await (api.shipments as any).create(validatedData)

      // Success!
      toast.success('Shipment added successfully', {
        description: `Tracking #${validatedData.trackingNumber} has been added.`,
      })
      
      setFormData({ 
        poNumber: '', 
        trackingNumber: '', 
        carrier: 'ups',
        supplier: '',
        shippedDate: '',
        estimatedDelivery: '',
      })
      setIsOpen(false)
      onSuccess()
    } catch (error: any) {
      if (error instanceof ZodError) {
        // Handle Zod validation errors
        const newErrors: FormErrors = {}
        error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof FormErrors
          newErrors[field] = issue.message
        })
        setErrors(newErrors)
        toast.error('Validation failed', {
          description: 'Please check the form for errors.',
        })
      } else {
        toast.error('Failed to create shipment', {
          description: error.message || 'An unexpected error occurred.',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Add Shipment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Shipment</DialogTitle>
          <DialogDescription>
            Enter the shipment details to start tracking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="poNumber">
              PO Number <span className="text-muted-foreground text-sm">(Optional)</span>
            </Label>
            <Input
              id="poNumber"
              value={formData.poNumber}
              onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
              placeholder="PO-12345"
            />
            {errors.poNumber && (
              <p className="text-sm text-destructive">{errors.poNumber}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingNumber">
              Tracking Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="trackingNumber"
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              placeholder="1Z999AA10123456784"
              required
            />
            {errors.trackingNumber && (
              <p className="text-sm text-destructive">{errors.trackingNumber}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="carrier">
              Carrier <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.carrier}
              onValueChange={(value) => setFormData({ ...formData, carrier: value as any })}
            >
              <SelectTrigger id="carrier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ups">UPS</SelectItem>
                <SelectItem value="fedex">FedEx</SelectItem>
                <SelectItem value="usps">USPS</SelectItem>
                <SelectItem value="dhl">DHL</SelectItem>
              </SelectContent>
            </Select>
            {errors.carrier && (
              <p className="text-sm text-destructive">{errors.carrier}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">
              Supplier <span className="text-muted-foreground text-sm">(Optional)</span>
            </Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Supplier name"
            />
            {errors.supplier && (
              <p className="text-sm text-destructive">{errors.supplier}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shippedDate">
                Shipped Date <span className="text-muted-foreground text-sm">(Optional)</span>
              </Label>
              <Input
                id="shippedDate"
                type="date"
                value={formData.shippedDate}
                onChange={(e) => setFormData({ ...formData, shippedDate: e.target.value })}
              />
              {errors.shippedDate && (
                <p className="text-sm text-destructive">{errors.shippedDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDelivery">
                Est. Delivery <span className="text-muted-foreground text-sm">(Optional)</span>
              </Label>
              <Input
                id="estimatedDelivery"
                type="date"
                value={formData.estimatedDelivery}
                onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
              />
              {errors.estimatedDelivery && (
                <p className="text-sm text-destructive">{errors.estimatedDelivery}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Shipment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
