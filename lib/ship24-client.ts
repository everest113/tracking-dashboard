/**
 * Ship24 API client for multi-carrier tracking
 * Docs: https://docs.ship24.com/
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

export interface TrackerRegistration {
  trackerId: string
  trackingNumber: string
  courierCode?: string
  shipmentReference?: string
}

export interface Ship24Error {
  error: string
  message?: string
}

const SHIP24_API_URL = 'https://api.ship24.com/public/v1'

/**
 * Map Ship24 status to our internal status
 */
export function mapShip24Status(ship24Status: string): string {
  const normalized = ship24Status.toLowerCase()
  
  const statusMap: Record<string, string> = {
    // Ship24 standard statuses
    'info_received': 'pending',
    'in_transit': 'in_transit',
    'out_for_delivery': 'out_for_delivery',
    'available_for_pickup': 'in_transit',
    'delivered': 'delivered',
    'delivery_delayed': 'exception',
    'delivery_failed': 'exception',
    'exception': 'exception',
    'expired': 'exception',
    'pending': 'pending',
    'unknown': 'pending',
  }
  
  return statusMap[normalized] || 'pending'
}

/**
 * Normalize carrier code for Ship24 API
 */
export function normalizeCarrierCode(carrier: string | null): string | null {
  if (!carrier) return null
  
  const normalized = carrier.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Ship24 carrier codes (lowercase, no special chars)
  const carrierMap: Record<string, string> = {
    'usps': 'usps',
    'fedex': 'fedex',
    'ups': 'ups',
    'dhl': 'dhl',
    'dhlexpress': 'dhl',
    'australiapost': 'australiapost',
    'canadapost': 'canadapost',
  }
  
  return carrierMap[normalized] || null
}

/**
 * Register a tracker with Ship24 (async, for webhook-based tracking)
 * Returns trackerId that should be stored in database
 */
export async function registerTracker(
  trackingNumber: string,
  carrier: string | null,
  shipmentReference?: string
): Promise<TrackerRegistration> {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY not configured')
  }
  
  const url = `${SHIP24_API_URL}/trackers`
  
  const requestBody: any = {
    trackingNumber: trackingNumber
  }
  
  // Include courier code if known
  const carrierCode = normalizeCarrierCode(carrier)
  if (carrierCode) {
    requestBody.courierCode = [carrierCode]
  }
  
  // Add shipment reference if provided (e.g., PO number)
  if (shipmentReference) {
    requestBody.shipmentReference = shipmentReference
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(
      `Ship24 tracker registration failed (${response.status}): ${errorData.message || errorData.error || response.statusText}`
    )
  }
  
  const data = await response.json()
  
  // Extract trackerId from response
  const trackerId = data.data?.tracker?.trackerId
  
  if (!trackerId) {
    throw new Error('Ship24 did not return a trackerId')
  }
  
  return {
    trackerId,
    trackingNumber,
    courierCode: carrierCode || undefined,
    shipmentReference
  }
}

/**
 * Bulk register multiple trackers (more efficient)
 */
export async function registerTrackersBulk(
  trackers: Array<{ trackingNumber: string; carrier: string | null; shipmentReference?: string }>
): Promise<TrackerRegistration[]> {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY not configured')
  }
  
  const url = `${SHIP24_API_URL}/trackers/bulk`
  
  const requestBody = trackers.map(t => {
    const body: any = {
      trackingNumber: t.trackingNumber
    }
    
    const carrierCode = normalizeCarrierCode(t.carrier)
    if (carrierCode) {
      body.courierCode = [carrierCode]
    }
    
    if (t.shipmentReference) {
      body.shipmentReference = t.shipmentReference
    }
    
    return body
  })
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(
      `Ship24 bulk registration failed (${response.status}): ${errorData.message || errorData.error || response.statusText}`
    )
  }
  
  const data = await response.json()
  
  // Extract trackerIds from response
  const registrations: TrackerRegistration[] = []
  const trackersData = data.data?.trackers || []
  
  for (const tracker of trackersData) {
    if (tracker.trackerId) {
      registrations.push({
        trackerId: tracker.trackerId,
        trackingNumber: tracker.trackingNumber,
        courierCode: tracker.courierCode?.[0],
        shipmentReference: tracker.shipmentReference
      })
    }
  }
  
  return registrations
}

/**
 * Get tracking results for an existing tracker by trackerId (fast, cached)
 * This uses Ship24's cached data and doesn't re-fetch from courier
 */
export async function getTrackerResults(trackerId: string): Promise<TrackingInfo> {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY not configured')
  }
  
  const url = `${SHIP24_API_URL}/trackers/${trackerId}/results`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(
      `Ship24 API error (${response.status}): ${errorData.message || errorData.error || response.statusText}`
    )
  }
  
  const data = await response.json()
  
  // Transform Ship24 response to our standard format
  return transformShip24Response(data, trackerId)
}

/**
 * Get tracking information for a shipment using Ship24 (synchronous)
 * This creates a tracker and fetches results immediately (slower, but works without pre-registration)
 */
export async function getTrackingInfo(
  trackingNumber: string,
  carrier: string | null
): Promise<TrackingInfo> {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    throw new Error('SHIP24_API_KEY not configured')
  }
  
  const url = `${SHIP24_API_URL}/trackers/track`
  
  const requestBody: any = {
    trackingNumber: trackingNumber
  }
  
  // Include courier code if known
  const carrierCode = normalizeCarrierCode(carrier)
  if (carrierCode) {
    requestBody.courierCode = [carrierCode]
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(
      `Ship24 API error (${response.status}): ${errorData.message || errorData.error || response.statusText}`
    )
  }
  
  const data = await response.json()
  
  // Transform Ship24 response to our standard format
  return transformShip24Response(data, trackingNumber)
}

/**
 * Transform Ship24 API response to our standard TrackingInfo format
 */
function transformShip24Response(ship24Data: any, trackingIdentifier: string): TrackingInfo {
  // Ship24 response structure:
  // { data: { trackings: [{ tracker: {...}, shipment: {...}, events: [...] }] } }
  
  const tracking = ship24Data.data?.trackings?.[0]
  
  if (!tracking) {
    throw new Error('No tracking data found')
  }
  
  const shipment = tracking.shipment || {}
  const tracker = tracking.tracker || {}
  const events = tracking.events || []
  
  // Get latest status
  const latestStatus = shipment.statusMilestone || shipment.status || 'unknown'
  const deliveryDate = shipment.delivery?.estimatedDeliveryDate || null
  const actualDeliveryDate = shipment.delivery?.actualDeliveryDate || null
  const shipDate = shipment.shipDate || null
  
  // Transform events to our format
  const transformedEvents: TrackingEvent[] = events.map((event: any) => {
    const location = event.location || {}
    const status = event.status || 'unknown'
    
    return {
      occurred_at: event.datetime || event.occurrenceDateTime || new Date().toISOString(),
      carrier_occurred_at: event.datetime || null,
      description: event.statusDetails || event.status || 'Status update',
      city_locality: location.city || null,
      state_province: location.state || null,
      postal_code: location.postalCode || null,
      country_code: location.countryCode || null,
      company_name: null,
      signer: event.recipientName || null,
      event_code: status,
      carrier_status_code: event.carrierCode || '',
      carrier_status_description: event.statusDetails || status,
      status_code: mapShip24StatusToCode(status),
      status_description: event.statusDetails || status,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
    }
  })
  
  return {
    tracking_number: tracker.trackingNumber || trackingIdentifier,
    status_code: mapShip24StatusToCode(latestStatus),
    status_description: latestStatus,
    carrier_status_code: tracker.courierCode || '',
    carrier_status_description: latestStatus,
    ship_date: shipDate,
    estimated_delivery_date: deliveryDate,
    actual_delivery_date: actualDeliveryDate,
    exception_description: shipment.exceptionMessage || null,
    events: transformedEvents,
  }
}

/**
 * Map Ship24 status to status code
 */
function mapShip24StatusToCode(status: string): 'AC' | 'IT' | 'DE' | 'EX' | 'UN' | 'AT' | 'NY' | 'SP' {
  const normalized = status.toLowerCase()
  
  const codeMap: Record<string, 'AC' | 'IT' | 'DE' | 'EX' | 'UN' | 'AT' | 'NY' | 'SP'> = {
    'info_received': 'AC',
    'in_transit': 'IT',
    'out_for_delivery': 'AT',
    'available_for_pickup': 'SP',
    'delivered': 'DE',
    'delivery_delayed': 'EX',
    'delivery_failed': 'EX',
    'exception': 'EX',
    'expired': 'EX',
    'pending': 'NY',
    'unknown': 'UN',
  }
  
  return codeMap[normalized] || 'UN'
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
