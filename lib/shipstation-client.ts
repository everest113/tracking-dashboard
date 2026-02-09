/**
 * ShipStation/ShipEngine API client for tracking
 * Docs: https://www.shipengine.com/docs/tracking/
 */

export interface TrackingEvent {
  occurred_at: string
  carrier_occurred_at: string | null
  description: string
  city_locality: string | null
  state_province: string | null
  postal_code: string | null
  country_code: string | null
  company_name: string | null
  signer: string | null
  event_code: string
  carrier_status_code: string
  carrier_status_description: string
  status_code: 'AC' | 'IT' | 'DE' | 'EX' | 'UN' | 'AT' | 'NY' | 'SP'
  status_description: string
  latitude: number | null
  longitude: number | null
}

export interface TrackingInfo {
  tracking_number: string
  status_code: string
  status_description: string
  carrier_status_code: string
  carrier_status_description: string
  ship_date: string | null
  estimated_delivery_date: string | null
  actual_delivery_date: string | null
  exception_description: string | null
  events: TrackingEvent[]
}

export interface ShipStationError {
  error: string
  message?: string
}

const SHIPENGINE_API_URL = 'https://api.shipengine.com/v1'

/**
 * Map ShipStation status codes to our internal status
 */
export function mapShipStationStatus(statusCode: string): string {
  const statusMap: Record<string, string> = {
    'AC': 'pending',        // Accepted
    'NY': 'pending',        // Not Yet In System
    'IT': 'in_transit',     // In Transit
    'AT': 'in_transit',     // Delivery Attempt
    'DE': 'delivered',      // Delivered
    'SP': 'delivered',      // Delivered to Service Point
    'EX': 'exception',      // Exception
    'UN': 'exception',      // Unknown
  }
  
  return statusMap[statusCode] || 'pending'
}

/**
 * Normalize carrier code for ShipEngine API
 * ShipEngine uses specific carrier codes
 */
export function normalizeCarrierCode(carrier: string | null): string {
  if (!carrier) return 'auto'
  
  const normalized = carrier.toLowerCase().replace(/[^a-z0-9]/g, '_')
  
  // Common mappings
  const carrierMap: Record<string, string> = {
    'usps': 'stamps_com',  // USPS via Stamps.com
    'fedex': 'fedex',
    'ups': 'ups',
    'dhl': 'dhl_express',
    'dhl_express': 'dhl_express',
    'australia_post': 'australia_post',
    'canada_post': 'canada_post',
  }
  
  return carrierMap[normalized] || normalized
}

/**
 * Get tracking information for a shipment
 */
export async function getTrackingInfo(
  trackingNumber: string,
  carrier: string | null
): Promise<TrackingInfo> {
  const apiKey = process.env.SHIPSTATION_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIPSTATION_API_KEY not configured')
  }
  
  const carrierCode = normalizeCarrierCode(carrier)
  
  const url = `${SHIPENGINE_API_URL}/tracking?carrier_code=${carrierCode}&tracking_number=${encodeURIComponent(trackingNumber)}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(
      `ShipStation API error (${response.status}): ${errorData.message || errorData.error || response.statusText}`
    )
  }
  
  const data: TrackingInfo = await response.json()
  
  return data
}

/**
 * Batch tracking lookup (process multiple in parallel)
 */
export async function getTrackingInfoBatch(
  shipments: Array<{ trackingNumber: string; carrier: string | null }>
): Promise<Array<{ trackingNumber: string; data?: TrackingInfo; error?: string }>> {
  const results = await Promise.allSettled(
    shipments.map(async (shipment) => {
      try {
        const data = await getTrackingInfo(shipment.trackingNumber, shipment.carrier)
        return { trackingNumber: shipment.trackingNumber, data }
      } catch (error: any) {
        return { trackingNumber: shipment.trackingNumber, error: error.message }
      }
    })
  )
  
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return { trackingNumber: 'unknown', error: result.reason?.message || 'Unknown error' }
    }
  })
}
