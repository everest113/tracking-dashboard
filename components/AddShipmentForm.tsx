'use client'

import { useState } from 'react'
import { shipmentSchema, type ShipmentInput } from '@/lib/validations'
import { ZodError } from 'zod'
import { toast } from 'sonner'
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

      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 400 && data.details) {
          // Handle Zod validation errors from server
          const newErrors: FormErrors = {}
          data.details.forEach((err: { field: string; message: string }) => {
            newErrors[err.field as keyof FormErrors] = err.message
          })
          setErrors(newErrors)
          toast.error('Validation failed', {
            description: 'Please check the form for errors.',
          })
        } else {
          toast.error('Failed to create shipment', {
            description: data.error || 'An unexpected error occurred.',
          })
        }
        return
      }

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
    } catch (error) {
      if (error instanceof ZodError) {
        // Client-side validation errors
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
        toast.error('An unexpected error occurred', {
          description: 'Please try again later.',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof ShipmentInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="success" size="default">
          + Add Shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Shipment</DialogTitle>
          <DialogDescription>
            Enter the shipment details below. Only tracking number and carrier are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PO Number */}
          <div className="space-y-2">
            <Label htmlFor="poNumber">PO Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="poNumber"
              value={formData.poNumber}
              onChange={(e) => handleChange('poNumber', e.target.value)}
              placeholder="PO-12345"
              disabled={isSubmitting}
              className={errors.poNumber ? 'border-red-500' : ''}
            />
            {errors.poNumber && (
              <p className="text-sm text-red-600">{errors.poNumber}</p>
            )}
          </div>

          {/* Tracking Number */}
          <div className="space-y-2">
            <Label htmlFor="trackingNumber">Tracking Number <span className="text-red-500">*</span></Label>
            <Input
              id="trackingNumber"
              value={formData.trackingNumber}
              onChange={(e) => handleChange('trackingNumber', e.target.value.toUpperCase())}
              placeholder="1Z999AA10123456784"
              disabled={isSubmitting}
              className={errors.trackingNumber ? 'border-red-500' : ''}
            />
            {errors.trackingNumber && (
              <p className="text-sm text-red-600">{errors.trackingNumber}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Letters and numbers only, automatically converted to uppercase
            </p>
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier <span className="text-red-500">*</span></Label>
            <Select
              value={formData.carrier}
              onValueChange={(value) => handleChange('carrier', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger className={errors.carrier ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ups">UPS</SelectItem>
                <SelectItem value="usps">USPS</SelectItem>
                <SelectItem value="fedex">FedEx</SelectItem>
                <SelectItem value="dhl">DHL</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.carrier && (
              <p className="text-sm text-red-600">{errors.carrier}</p>
            )}
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => handleChange('supplier', e.target.value)}
              placeholder="Supplier name"
              disabled={isSubmitting}
              className={errors.supplier ? 'border-red-500' : ''}
            />
            {errors.supplier && (
              <p className="text-sm text-red-600">{errors.supplier}</p>
            )}
          </div>

          {/* Shipped Date */}
          <div className="space-y-2">
            <Label htmlFor="shippedDate">Shipped Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="shippedDate"
              type="date"
              value={formData.shippedDate}
              onChange={(e) => handleChange('shippedDate', e.target.value)}
              disabled={isSubmitting}
              className={errors.shippedDate ? 'border-red-500' : ''}
            />
            {errors.shippedDate && (
              <p className="text-sm text-red-600">{errors.shippedDate}</p>
            )}
          </div>

          {/* Estimated Delivery */}
          <div className="space-y-2">
            <Label htmlFor="estimatedDelivery">Estimated Delivery <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="estimatedDelivery"
              type="date"
              value={formData.estimatedDelivery}
              onChange={(e) => handleChange('estimatedDelivery', e.target.value)}
              disabled={isSubmitting}
              className={errors.estimatedDelivery ? 'border-red-500' : ''}
            />
            {errors.estimatedDelivery && (
              <p className="text-sm text-red-600">{errors.estimatedDelivery}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Adding...' : 'Add Shipment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
