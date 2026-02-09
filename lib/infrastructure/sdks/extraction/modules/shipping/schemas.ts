import { z } from 'zod'

/**
 * Shipping extraction schemas
 */

export const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number required'),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string().nullable().default(null),  // Explicitly nullable with default
  shippedDate: z.string().nullable().default(null), // ISO date string (YYYY-MM-DD)
  confidence: z.number().min(0).max(1).default(0.8),
})

export const TrackingExtractionResultSchema = z.object({
  supplier: z.string().nullable().default(null),
  shipments: z.array(ExtractedShipmentSchema),
})

export type ExtractedShipment = z.infer<typeof ExtractedShipmentSchema>
export type TrackingExtractionResult = z.infer<typeof TrackingExtractionResultSchema>

/**
 * Input schema for email messages
 */
export const EmailMessageSchema = z.object({
  subject: z.string(),
  body: z.string(),
  senderEmail: z.string().optional(),
  senderName: z.string().optional(),
  sentDate: z.date().optional(),
})

export type EmailMessage = z.infer<typeof EmailMessageSchema>
