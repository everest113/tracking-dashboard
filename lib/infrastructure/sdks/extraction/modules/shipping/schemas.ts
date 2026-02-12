import { z } from 'zod'

/**
 * Shipping extraction schemas
 * 
 * Split into focused schemas for better extraction accuracy:
 * 1. TrackingExtractionSchema - just tracking numbers
 * 2. MetadataExtractionSchema - supplier, PO, dates
 */

// ============================================
// Schema 1: Tracking Numbers + Shipped Date
// ============================================

export const ExtractedTrackingSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number required'),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  shippedDate: z.string(),  // Empty string if not found, ISO format (YYYY-MM-DD) if found
  confidence: z.number().min(0).max(1),
})

export const TrackingOnlyResultSchema = z.object({
  shipments: z.array(ExtractedTrackingSchema),
})

export type ExtractedTracking = z.infer<typeof ExtractedTrackingSchema>
export type TrackingOnlyResult = z.infer<typeof TrackingOnlyResultSchema>

// ============================================
// Schema 2: Metadata (supplier, PO)
// ============================================

export const MetadataExtractionSchema = z.object({
  supplier: z.string(),  // Empty string if not found
  poNumber: z.string(),  // Empty string if not found
})

export type MetadataExtraction = z.infer<typeof MetadataExtractionSchema>

// ============================================
// Combined result (for backward compatibility)
// ============================================

export const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number required'),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string(),
  shippedDate: z.string(),
  confidence: z.number().min(0).max(1),
})

export const TrackingExtractionResultSchema = z.object({
  supplier: z.string(),
  shipments: z.array(ExtractedShipmentSchema),
})

export type ExtractedShipment = z.infer<typeof ExtractedShipmentSchema>
export type TrackingExtractionResult = z.infer<typeof TrackingExtractionResultSchema>

// ============================================
// Input schema for email messages
// ============================================

export const EmailMessageSchema = z.object({
  subject: z.string(),
  body: z.string(),
  senderEmail: z.string().optional(),
  senderName: z.string().optional(),
  sentDate: z.date().optional(),
})

export type EmailMessage = z.infer<typeof EmailMessageSchema>
