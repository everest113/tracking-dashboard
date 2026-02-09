import { z } from 'zod'

/**
 * Ship24 API Response Schemas (Zod validation)
 * These validate the raw API responses from Ship24
 */

// Tracker response
export const Ship24TrackerSchema = z.object({
  trackerId: z.string(),
  trackingNumber: z.string(),
  courierCode: z.array(z.string()).optional(),
  shipmentReference: z.string().optional(),
})

export const Ship24TrackerResponseSchema = z.object({
  data: z.object({
    tracker: Ship24TrackerSchema,
  }),
})

export const Ship24BulkTrackerResponseSchema = z.object({
  data: z.object({
    trackers: z.array(Ship24TrackerSchema),
  }),
})

// Tracking event
export const Ship24EventLocationSchema = z.object({
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

export const Ship24EventSchema = z.object({
  datetime: z.string().optional(),
  occurrenceDateTime: z.string().optional(),
  status: z.string(),
  statusDetails: z.string().optional(),
  location: Ship24EventLocationSchema.optional(),
  recipientName: z.string().nullable().optional(),
  carrierCode: z.string().optional(),
})

// Shipment tracking response
export const Ship24DeliverySchema = z.object({
  estimatedDeliveryDate: z.string().nullable().optional(),
  actualDeliveryDate: z.string().nullable().optional(),
})

export const Ship24ShipmentSchema = z.object({
  status: z.string().optional(),
  statusMilestone: z.string().optional(),
  shipDate: z.string().nullable().optional(),
  delivery: Ship24DeliverySchema.optional(),
  exceptionMessage: z.string().nullable().optional(),
})

export const Ship24TrackingSchema = z.object({
  tracker: Ship24TrackerSchema,
  shipment: Ship24ShipmentSchema.optional(),
  events: z.array(Ship24EventSchema).optional(),
})

export const Ship24TrackingResponseSchema = z.object({
  data: z.object({
    trackings: z.array(Ship24TrackingSchema),
  }),
})

// Webhook payload
export const Ship24WebhookPayloadSchema = z.object({
  webhook: z.object({
    id: z.string(),
    trackerId: z.string(),
  }).optional(),
  data: z.object({
    trackings: z.array(Ship24TrackingSchema),
  }),
})

// Type exports
export type Ship24TrackerResponse = z.infer<typeof Ship24TrackerResponseSchema>
export type Ship24BulkTrackerResponse = z.infer<typeof Ship24BulkTrackerResponseSchema>
export type Ship24TrackingResponse = z.infer<typeof Ship24TrackingResponseSchema>
export type Ship24WebhookPayload = z.infer<typeof Ship24WebhookPayloadSchema>
export type Ship24Tracker = z.infer<typeof Ship24TrackerSchema>
export type Ship24Tracking = z.infer<typeof Ship24TrackingSchema>
export type Ship24Event = z.infer<typeof Ship24EventSchema>
export type Ship24Shipment = z.infer<typeof Ship24ShipmentSchema>
