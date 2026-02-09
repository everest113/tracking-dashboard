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

    // Get status
    const latestStatus = shipment.statusMilestone || shipment.status || 'unknown'
    const status = this.mapStatus(latestStatus)

    // Get dates
    const shippedDate = shipment.shipDate ? new Date(shipment.shipDate) : null
    const estimatedDelivery = shipment.delivery?.estimatedDeliveryDate 
      ? new Date(shipment.delivery.estimatedDeliveryDate) 
      : null
    const deliveredDate = shipment.delivery?.actualDeliveryDate 
      ? new Date(shipment.delivery.actualDeliveryDate) 
      : null

    // Get carrier
    const carrier = tracker.courierCode?.[0] || null

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
    
    const location = this.formatLocation(event)

    return {
      occurredAt,
      description,
      status,
      location,
    }
  }

  /**
   * Format location from Ship24 event
   */
  private static formatLocation(event: Ship24Event): string | null {
    const location = event.location
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
   */
  static normalizeCarrierCode(carrier: string | null): string[] | undefined {
    if (!carrier) return undefined
    
    const normalized = carrier.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    const carrierMap: Record<string, string> = {
      'ups': 'ups',
      'fedex': 'fedex',
      'usps': 'usps',
      'dhl': 'dhl',
      'ontrac': 'ontrac',
      'lasership': 'lasership',
    }

    const code = carrierMap[normalized]
    return code ? [code] : undefined
  }
}
