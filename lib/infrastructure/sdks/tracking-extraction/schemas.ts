import { z } from 'zod'

/**
 * Zod schemas for AI-powered tracking extraction
 * These define the expected structure of AI responses
 */

export const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number required'),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string().optional(),
  shippedDate: z.string().optional(), // ISO date string (YYYY-MM-DD)
  confidence: z.number().min(0).max(1),
})

export const ExtractionResultSchema = z.object({
  supplier: z.string().optional(),
  shipments: z.array(ExtractedShipmentSchema),
})

export type ExtractedShipment = z.infer<typeof ExtractedShipmentSchema>
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>

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
