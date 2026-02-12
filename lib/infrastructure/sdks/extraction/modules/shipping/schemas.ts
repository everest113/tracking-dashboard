import { z } from 'zod'

/**
 * Shipping extraction schemas
 * 
 * ALL fields are required for OpenAI structured outputs compatibility
 * Use empty strings for missing data
 */

export const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number required'),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),  // AI must always provide
  poNumber: z.string(),  // Use empty string "" if not found
  shippedDate: z.string(),  // Use empty string "" if not found  
  confidence: z.number().min(0).max(1),  // AI must provide 0-1
})

export const TrackingExtractionResultSchema = z.object({
  supplier: z.string(),  // Use empty string "" if not found
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
