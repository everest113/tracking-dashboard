import { z } from 'zod'
import {
  Ship24TrackerResponseSchema,
  Ship24BulkTrackerResponseSchema,
  Ship24TrackingResponseSchema,
  type Ship24TrackerResponse,
  type Ship24BulkTrackerResponse,
  type Ship24TrackingResponse,
} from './schemas'

/**
 * Ship24 SDK Client
 * Handles raw API communication and response validation with Zod
 * Does NOT transform to domain models (that's the mapper's job)
 */

export interface Ship24Config {
  apiKey: string
  baseUrl?: string
}

export interface RegisterTrackerRequest {
  trackingNumber: string
  courierCode?: string[]
  shipmentReference?: string
}

export class Ship24ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'Ship24ApiError'
  }
}

export class Ship24Client {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config: Ship24Config) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.ship24.com/public/v1'
  }

  /**
   * Register a single tracker
   */
  async registerTracker(request: RegisterTrackerRequest): Promise<Ship24TrackerResponse> {
    const response = await this.post('/trackers', request)
    
    // Validate response with Zod
    const parsed = Ship24TrackerResponseSchema.safeParse(response)
    
    if (!parsed.success) {
      throw new Ship24ApiError(
        `Invalid Ship24 response: ${parsed.error.message}`,
        undefined,
        response
      )
    }
    
    return parsed.data
  }

  /**
   * Register multiple trackers in bulk
   */
  async registerTrackersBulk(requests: RegisterTrackerRequest[]): Promise<Ship24BulkTrackerResponse> {
    const response = await this.post('/trackers/bulk', requests)
    
    const parsed = Ship24BulkTrackerResponseSchema.safeParse(response)
    
    if (!parsed.success) {
      throw new Ship24ApiError(
        `Invalid Ship24 bulk response: ${parsed.error.message}`,
        undefined,
        response
      )
    }
    
    return parsed.data
  }

  /**
   * Get tracking results for a tracker by ID (cached)
   */
  async getTrackerResults(trackerId: string): Promise<Ship24TrackingResponse> {
    const response = await this.get(`/trackers/${trackerId}/results`)
    
    const parsed = Ship24TrackingResponseSchema.safeParse(response)
    
    if (!parsed.success) {
      throw new Ship24ApiError(
        `Invalid Ship24 tracking response: ${parsed.error.message}`,
        undefined,
        response
      )
    }
    
    return parsed.data
  }

  /**
   * Create tracker and get results synchronously
   */
  async trackShipment(request: RegisterTrackerRequest): Promise<Ship24TrackingResponse> {
    const response = await this.post('/trackers/track', request)
    
    const parsed = Ship24TrackingResponseSchema.safeParse(response)
    
    if (!parsed.success) {
      throw new Ship24ApiError(
        `Invalid Ship24 tracking response: ${parsed.error.message}`,
        undefined,
        response
      )
    }
    
    return parsed.data
  }

  /**
   * HTTP GET request
   */
  private async get(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Ship24ApiError(
        `Ship24 API error: ${errorData.message || errorData.error || response.statusText}`,
        response.status,
        errorData
      )
    }
    
    return response.json()
  }

  /**
   * HTTP POST request
   */
  private async post(path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Ship24ApiError(
        `Ship24 API error: ${errorData.message || errorData.error || response.statusText}`,
        response.status,
        errorData
      )
    }
    
    return response.json()
  }
}

/**
 * Factory function to create Ship24 client from environment
 */
export function createShip24Client(): Ship24Client {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY environment variable not set')
  }
  
  return new Ship24Client({ apiKey })
}
