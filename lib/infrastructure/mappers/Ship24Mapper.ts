import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'
import type { Ship24Tracking, Ship24Event } from '../sdks/ship24/schemas'

/**
 * Ship24Mapper
 * Transforms Ship24 API responses to domain models
 * Separate from SDK to keep concerns separated
 */

export interface TrackingUpdateData {
  status: ShipmentStatus
  ship24TrackerId: string
  trackingNumber: string
  carrier: string | null
  shippedDate: Date | null
  estimatedDelivery: Date | null
  deliveredDate: Date | null
  events: TrackingEventData[]
}

export interface TrackingEventData {
  occurredAt: Date
  description: string
  status: string
  location: string | null
}

export class Ship24Mapper {
  /**
   * Map Ship24 tracking response to domain data
   */
  static toDomainTrackingUpdate(tracking: Ship24Tracking): TrackingUpdateData {
    const tracker = tracking.tracker
    const shipment = tracking.shipment || {}
    const events = tracking.events || []
    const statistics = tracking.statistics || {}

    // Get status
    const latestStatus = shipment.statusMilestone || shipment.status || 'unknown'
    const status = this.mapStatus(latestStatus)

    // Get dates - Ship24 can provide dates in multiple places
    // 1. Try shipment.shipDate (not commonly populated)
    // 2. Try statistics.timestamps.infoReceivedDatetime as fallback
    let shippedDate: Date | null = null
    if (shipment.shipDate) {
      shippedDate = new Date(shipment.shipDate)
    } else if (statistics.timestamps?.infoReceivedDatetime) {
      shippedDate = new Date(statistics.timestamps.infoReceivedDatetime)
    }

    // Estimated delivery - try multiple sources
    let estimatedDelivery: Date | null = null
    if (shipment.delivery?.estimatedDeliveryDate) {
      estimatedDelivery = new Date(shipment.delivery.estimatedDeliveryDate)
    } else if (shipment.delivery?.courierEstimatedDeliveryDate) {
      estimatedDelivery = new Date(shipment.delivery.courierEstimatedDeliveryDate)
    }

    // Delivered date - Ship24 stores this in statistics.timestamps
    let deliveredDate: Date | null = null
    if (shipment.delivery?.actualDeliveryDate) {
      deliveredDate = new Date(shipment.delivery.actualDeliveryDate)
    } else if (statistics.timestamps?.deliveredDatetime) {
      deliveredDate = new Date(statistics.timestamps.deliveredDatetime)
    }

    // Get carrier - try multiple sources
    const carrier = tracker.courierCode?.[0] || 
                   (events[0]?.carrierCode) || 
                   null

    // Map events
    const mappedEvents = events.map(event => this.mapEvent(event))

    return {
      status,
      ship24TrackerId: tracker.trackerId,
      trackingNumber: tracker.trackingNumber,
      carrier,
      shippedDate,
      estimatedDelivery,
      deliveredDate,
      events: mappedEvents,
    }
  }

  /**
   * Map Ship24 status to domain status
   */
  private static mapStatus(ship24Status: string): ShipmentStatus {
    const normalized = ship24Status.toLowerCase()
    
    const statusMap: Record<string, string> = {
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
    
    const mappedStatus = statusMap[normalized] || 'pending'
    const result = ShipmentStatus.create(mappedStatus)
    
    // If creation fails (shouldn't happen with our mapping), default to pending
    return result.success ? result.value : ShipmentStatus.pending()
  }

  /**
   * Map Ship24 event to domain event data
   */
  private static mapEvent(event: Ship24Event): TrackingEventData {
    const occurredAt = event.datetime || event.occurrenceDateTime 
      ? new Date(event.datetime || event.occurrenceDateTime!) 
      : new Date()
    
    const description = event.statusDetails || event.status || 'Status update'
    const status = event.status || 'unknown'
    
    const location = event.location
    let locationStr: string | null = null
    
    if (typeof location === 'string') {
      locationStr = location
    } else if (location && typeof location === 'object') {
      locationStr = this.formatLocationObject(location)
    }

    return {
      occurredAt,
      description,
      status,
      location: locationStr,
    }
  }

  /**
   * Format location object from Ship24 event
   */
  private static formatLocationObject(location: { city?: string | null; state?: string | null; postalCode?: string | null }): string | null {
    if (!location || !location.city) {
      return null
    }

    const parts = [
      location.city,
      location.state,
      location.postalCode,
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(', ') : null
  }

  /**
   * Normalize carrier code for Ship24 API
   * Based on Ship24 OpenAPI spec examples
   */
  static normalizeCarrierCode(carrier: string | null): string[] | undefined {
    if (!carrier) return undefined
    
    const normalized = carrier.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Ship24 uses specific courier codes (from OpenAPI spec)
    const carrierMap: Record<string, string> = {
      'ups': 'ups',
      'fedex': 'fedex',
      'usps': 'us-post',  // Ship24 uses "us-post" not "usps"
      'dhl': 'dhl',
      'ontrac': 'ontrac',
      'lasership': 'lasership',
    }

    const code = carrierMap[normalized]
    return code ? [code] : undefined
  }
}
