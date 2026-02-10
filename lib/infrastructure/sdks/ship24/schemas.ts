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
  location: z.union([
    z.null(),
    z.string(),
    Ship24EventLocationSchema
  ]).optional(),
  recipientName: z.string().nullable().optional(),
  carrierCode: z.string().optional(),
})

// Shipment tracking response
export const Ship24DeliverySchema = z.object({
  estimatedDeliveryDate: z.string().nullable().optional(),
  courierEstimatedDeliveryDate: z.string().nullable().optional(),
  actualDeliveryDate: z.string().nullable().optional(),
})

export const Ship24ShipmentSchema = z.object({
  status: z.string().optional(),
  statusMilestone: z.string().optional(),
  shipDate: z.string().nullable().optional(),
  delivery: Ship24DeliverySchema.optional(),
  exceptionMessage: z.string().nullable().optional(),
})

export const Ship24StatisticsSchema = z.object({
  timestamps: z.object({
    infoReceivedDatetime: z.string().nullable().optional(),
    inTransitDatetime: z.string().nullable().optional(),
    outForDeliveryDatetime: z.string().nullable().optional(),
    failedAttemptDatetime: z.string().nullable().optional(),
    availableForPickupDatetime: z.string().nullable().optional(),
    exceptionDatetime: z.string().nullable().optional(),
    deliveredDatetime: z.string().nullable().optional(),
  }).optional(),
}).optional()

export const Ship24TrackingSchema = z.object({
  tracker: Ship24TrackerSchema,
  shipment: Ship24ShipmentSchema.optional(),
  events: z.array(Ship24EventSchema).optional(),
  statistics: Ship24StatisticsSchema,
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
export type Ship24TrackingResponse = z.infer<typeof Ship24TrackingResponseSchema>
export type Ship24WebhookPayload = z.infer<typeof Ship24WebhookPayloadSchema>
export type Ship24Tracker = z.infer<typeof Ship24TrackerSchema>
export type Ship24Tracking = z.infer<typeof Ship24TrackingSchema>
export type Ship24Event = z.infer<typeof Ship24EventSchema>
export type Ship24Shipment = z.infer<typeof Ship24ShipmentSchema>

// Bulk tracker response schema (based on OpenAPI spec)
export const Ship24BulkTrackerResponseSchema = z.object({
  status: z.enum(['success', 'partial', 'error']),
  summary: z.object({
    totalInputs: z.number(),
    totalCreated: z.number(),
    totalExisting: z.number(),
    totalErrors: z.number(),
  }).nullable(),
  data: z.array(z.object({
    itemStatus: z.enum(['created', 'existing', 'error']),
    inputData: z.any(), // The request payload echoed back
    tracker: Ship24TrackerSchema.nullable(),
    errors: z.array(z.object({
      code: z.string(),
      message: z.string(),
    })).nullable(),
  })).nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).nullable(),
})

export type Ship24BulkTrackerResponse = z.infer<typeof Ship24BulkTrackerResponseSchema>
