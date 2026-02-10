/**
 * Ship24 API Client
 * Based on official OpenAPI spec: https://docs.ship24.com/assets/openapi/ship24-tracking-api.yaml
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
   * POST /trackers
   */
  async registerTracker(
    trackingNumber: string,
    carrier?: string,
    poNumber?: string
  ): Promise<Ship24TrackerResponse> {
    const body: {
      trackingNumber: string
      courierCode?: string[]
      shipmentReference?: string
    } = {
      trackingNumber,
    }

    // courierCode is an array of courier codes
    if (carrier) {
      body.courierCode = [carrier]
    }

    // shipmentReference is for PO number or other reference
    if (poNumber) {
      body.shipmentReference = poNumber
    }

    return this.post('/trackers', body, Ship24TrackerResponseSchema)
  }

  /**
   * Register multiple trackers in bulk
   * POST /trackers/bulk
   * 
   * Note: Request body is an ARRAY, not {trackers: [...]}
   */
  async registerTrackersBulk(
    trackers: Array<{
      trackingNumber: string
      carrier?: string
      poNumber?: string
    }>
  ): Promise<Ship24BulkTrackerResponse> {
    // Convert to Ship24 format
    const payload = trackers.map(t => {
      const item: {
        trackingNumber: string
        courierCode?: string[]
        shipmentReference?: string
      } = {
        trackingNumber: t.trackingNumber,
      }

      if (t.carrier) {
        item.courierCode = [t.carrier]
      }

      if (t.poNumber) {
        item.shipmentReference = t.poNumber
      }

      return item
    })

    // Ship24 bulk endpoint expects the array directly, not wrapped
    return this.post('/trackers/bulk', payload, Ship24BulkTrackerResponseSchema)
  }

  /**
   * Get tracker results (cached from Ship24)
   * GET /trackers/:trackerId/results
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
