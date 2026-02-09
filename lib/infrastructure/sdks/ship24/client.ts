/**
 * Ship24 API Client
 * Refactored to use base SDK architecture with proper validation
 */

import { BaseSdkClient } from '../base-client'
import {
  Ship24TrackerResponseSchema,
  Ship24BulkTrackerResponseSchema,
  Ship24TrackingResponseSchema,
} from './schemas'
import type { z } from 'zod'

type Ship24TrackerResponse = z.infer<typeof Ship24TrackerResponseSchema>
type Ship24BulkTrackerResponse = z.infer<typeof Ship24BulkTrackerResponseSchema>
type Ship24TrackingResponse = z.infer<typeof Ship24TrackingResponseSchema>

export class Ship24Client extends BaseSdkClient {
  constructor(apiKey: string) {
    super({
      baseUrl: 'https://api.ship24.com/public/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
  }

  /**
   * Register a single tracker
   */
  async registerTracker(
    trackingNumber: string,
    carrier?: string
  ): Promise<Ship24TrackerResponse> {
    return this.post(
      '/trackers',
      {
        trackingNumber,
        ...(carrier && { shipmentReference: { carrierCode: carrier } }),
      },
      Ship24TrackerResponseSchema
    )
  }

  /**
   * Register multiple trackers in bulk
   */
  async registerTrackersBulk(
    trackers: Array<{
      trackingNumber: string
      carrier?: string
      poNumber?: string
    }>
  ): Promise<Ship24BulkTrackerResponse> {
    return this.post(
      '/trackers/register',
      {
        trackers: trackers.map(t => ({
          trackingNumber: t.trackingNumber,
          ...(t.carrier && { shipmentReference: { carrierCode: t.carrier } }),
          ...(t.poNumber && { shipmentReference: { ...t.carrier && { carrierCode: t.carrier }, referenceNumber: t.poNumber } }),
        })),
      },
      Ship24BulkTrackerResponseSchema
    )
  }

  /**
   * Get tracker results (cached from Ship24)
   */
  async getTrackerResults(trackerId: string): Promise<Ship24TrackingResponse> {
    return this.get(
      `/trackers/${trackerId}/results`,
      Ship24TrackingResponseSchema
    )
  }
}

/**
 * Factory function to create Ship24 client
 */
export function createShip24Client(): Ship24Client {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY environment variable is not set')
  }

  return new Ship24Client(apiKey)
}
