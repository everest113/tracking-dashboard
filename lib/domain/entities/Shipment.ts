import type { TrackingNumber } from '../value-objects/TrackingNumber'
import { TrackingNumber as TN } from '../value-objects/TrackingNumber'
import type { ShipmentStatus } from '../value-objects/ShipmentStatus'
import { ShipmentStatus as SS } from '../value-objects/ShipmentStatus'
import { Result, Ok, Err, DomainError } from '../core/Result'

/**
 * Shipment - Functional Domain Entity
 * Plain immutable object with pure functions for operations
 */
export interface Shipment {
  readonly id: number
  readonly poNumber: string | null
  readonly trackingNumber: TrackingNumber
  readonly carrier: string | null
  readonly supplier: string | null
  readonly status: ShipmentStatus
  readonly ship24TrackerId: string | null
  readonly shippedDate: Date | null
  readonly estimatedDelivery: Date | null
  readonly deliveredDate: Date | null
  readonly lastChecked: Date | null
  readonly frontConversationId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Props for creating a new Shipment
 */
export interface CreateShipmentProps {
  readonly id?: number
  readonly poNumber?: string | null
  readonly trackingNumber: TrackingNumber
  readonly carrier?: string | null
  readonly supplier?: string | null
  readonly status: ShipmentStatus
  readonly ship24TrackerId?: string | null
  readonly shippedDate?: Date | null
  readonly estimatedDelivery?: Date | null
  readonly deliveredDate?: Date | null
  readonly lastChecked?: Date | null
  readonly frontConversationId?: string | null
}

/**
 * Database record format
 */
export interface ShipmentRecord {
  readonly id: number
  readonly poNumber: string | null
  readonly trackingNumber: string
  readonly carrier: string | null
  readonly supplier: string | null
  readonly status: string
  readonly ship24TrackerId: string | null
  readonly shippedDate: Date | null
  readonly estimatedDelivery: Date | null
  readonly deliveredDate: Date | null
  readonly lastChecked: Date | null
  readonly frontConversationId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Shipment operations (pure functions)
 */
export const Shipment = {
  /**
   * Create a new Shipment
   */
  create(props: CreateShipmentProps): Shipment {
    const now = new Date()
    return {
      id: props.id || 0,
      poNumber: props.poNumber || null,
      trackingNumber: props.trackingNumber,
      carrier: props.carrier || null,
      supplier: props.supplier || null,
      status: props.status,
      ship24TrackerId: props.ship24TrackerId || null,
      shippedDate: props.shippedDate || null,
      estimatedDelivery: props.estimatedDelivery || null,
      deliveredDate: props.deliveredDate || null,
      lastChecked: props.lastChecked || null,
      frontConversationId: props.frontConversationId || null,
      createdAt: now,
      updatedAt: now,
    }
  },

  /**
   * Create from database record (trusted source)
   */
  fromDatabase(record: ShipmentRecord): Shipment {
    const statusResult = SS.create(record.status)
    const status = statusResult.success ? statusResult.value : SS.pending()

    return {
      id: record.id,
      poNumber: record.poNumber,
      trackingNumber: TN.unsafe(record.trackingNumber),
      carrier: record.carrier,
      supplier: record.supplier,
      status,
      ship24TrackerId: record.ship24TrackerId,
      shippedDate: record.shippedDate,
      estimatedDelivery: record.estimatedDelivery,
      deliveredDate: record.deliveredDate,
      lastChecked: record.lastChecked,
      frontConversationId: record.frontConversationId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  },

  /**
   * Convert to database format
   */
  toPersistence(shipment: Shipment): Omit<ShipmentRecord, 'createdAt'> {
    return {
      id: shipment.id === 0 ? 0 : shipment.id,
      poNumber: shipment.poNumber,
      trackingNumber: TN.toString(shipment.trackingNumber),
      carrier: shipment.carrier,
      supplier: shipment.supplier,
      status: SS.toString(shipment.status),
      ship24TrackerId: shipment.ship24TrackerId,
      shippedDate: shipment.shippedDate,
      estimatedDelivery: shipment.estimatedDelivery,
      deliveredDate: shipment.deliveredDate,
      lastChecked: shipment.lastChecked,
      frontConversationId: shipment.frontConversationId,
      updatedAt: shipment.updatedAt,
    }
  },

  // ============================================
  // IMMUTABLE OPERATIONS (return new Shipment)
  // ============================================

  /**
   * Update status (with business rule validation)
   */
  withStatus(
    shipment: Shipment,
    status: ShipmentStatus
  ): Result<Shipment, DomainError> {
    // Business rule: Can't change status of delivered shipment
    if (SS.isDelivered(shipment.status)) {
      return Err(new DomainError('Cannot change status of delivered shipment'))
    }

    // Business rule: Status transition must be valid
    if (!SS.canTransitionTo(shipment.status, status)) {
      return Err(new DomainError(`Invalid status transition: ${SS.toString(shipment.status)} -> ${SS.toString(status)}`))
    }

    return Ok({
      ...shipment,
      status,
      updatedAt: new Date(),
    })
  },

  /**
   * Update tracking data
   */
  withTracking(
    shipment: Shipment,
    data: {
      status?: ShipmentStatus
      ship24TrackerId?: string
      shippedDate?: Date
      estimatedDelivery?: Date
      deliveredDate?: Date
      carrier?: string
    }
  ): Shipment {
    return {
      ...shipment,
      status: data.status ?? shipment.status,
      ship24TrackerId: data.ship24TrackerId ?? shipment.ship24TrackerId,
      shippedDate: data.shippedDate ?? shipment.shippedDate,
      estimatedDelivery: data.estimatedDelivery ?? shipment.estimatedDelivery,
      deliveredDate: data.deliveredDate ?? shipment.deliveredDate,
      carrier: data.carrier ?? shipment.carrier,
      lastChecked: new Date(),
      updatedAt: new Date(),
    }
  },

  /**
   * Register Ship24 tracker
   */
  withTrackerId(
    shipment: Shipment,
    trackerId: string
  ): Result<Shipment, DomainError> {
    if (shipment.ship24TrackerId) {
      return Err(new DomainError('Tracker already registered'))
    }

    return Ok({
      ...shipment,
      ship24TrackerId: trackerId,
      updatedAt: new Date(),
    })
  },

  /**
   * Update lastChecked timestamp
   */
  withCheckedNow(shipment: Shipment): Shipment {
    return {
      ...shipment,
      lastChecked: new Date(),
      updatedAt: new Date(),
    }
  },

  // ============================================
  // QUERIES (pure predicates)
  // ============================================

  /**
   * Check if shipment is delivered
   */
  isDelivered(shipment: Shipment): boolean {
    return SS.isDelivered(shipment.status)
  },

  /**
   * Check if shipment needs tracking
   */
  needsTracking(shipment: Shipment): boolean {
    return !Shipment.isDelivered(shipment)
  },

  /**
   * Check if shipment has tracker registered
   */
  hasTracker(shipment: Shipment): boolean {
    return shipment.ship24TrackerId !== null
  },

  /**
   * Check if shipment is in transit
   */
  isInTransit(shipment: Shipment): boolean {
    return SS.isInTransit(shipment.status)
  },

  /**
   * Check if shipment has exception
   */
  hasException(shipment: Shipment): boolean {
    return SS.hasException(shipment.status)
  },

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Get display name for shipment
   */
  getDisplayName(shipment: Shipment): string {
    return shipment.poNumber 
      ? `${shipment.poNumber} (${TN.toString(shipment.trackingNumber)})`
      : TN.toString(shipment.trackingNumber)
  },

  /**
   * Get status message
   */
  getStatusMessage(shipment: Shipment): string {
    return SS.match(shipment.status, {
      pending: () => 'Awaiting shipment',
      in_transit: (loc) => loc ? `In transit - ${loc}` : 'In transit',
      out_for_delivery: (loc) => loc ? `Out for delivery - ${loc}` : 'Out for delivery',
      delivered: (date) => `Delivered on ${date.toLocaleDateString()}`,
      exception: (reason) => `Exception: ${reason}`,
      failed_attempt: (date) => `Delivery attempted on ${date.toLocaleDateString()}`,
    })
  }
}
