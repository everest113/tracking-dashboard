import { z } from 'zod'

export const shipmentSchema = z.object({
  poNumber: z.string()
    .min(1, 'PO Number is required')
    .max(255, 'PO Number is too long')
    .optional()
    .or(z.literal('')),
  
  trackingNumber: z.string()
    .min(1, 'Tracking Number is required')
    .max(255, 'Tracking Number is too long')
    .regex(/^[A-Z0-9]+$/, 'Tracking Number must contain only uppercase letters and numbers'),
  
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other'], {
    message: 'Please select a valid carrier',
  }),

  supplier: z.string()
    .max(255, 'Supplier name is too long')
    .optional()
    .or(z.literal('')),

  shippedDate: z.string()
    .optional()
    .or(z.literal('')),

  estimatedDelivery: z.string()
    .optional()
    .or(z.literal('')),
})

export type ShipmentInput = z.infer<typeof shipmentSchema>
