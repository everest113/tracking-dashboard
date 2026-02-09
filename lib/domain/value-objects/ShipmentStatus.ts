import { Result, Ok, Err, ValidationError } from '../core/Result'

/**
 * ShipmentStatus - Functional Value Object
 * Discriminated union for type-safe status handling
 */
export type ShipmentStatus = 
  | { readonly type: 'pending' }
  | { readonly type: 'in_transit'; readonly location?: string }
  | { readonly type: 'out_for_delivery'; readonly location?: string }
  | { readonly type: 'delivered'; readonly deliveredAt: Date }
  | { readonly type: 'exception'; readonly reason: string }
  | { readonly type: 'failed_attempt'; readonly attemptedAt: Date }

/**
 * ShipmentStatus operations (pure functions)
 */
export const ShipmentStatus = {
  /**
   * Factory functions for creating statuses
   */
  pending(): ShipmentStatus {
    return { type: 'pending' }
  },

  inTransit(location?: string): ShipmentStatus {
    return { type: 'in_transit', location }
  },

  outForDelivery(location?: string): ShipmentStatus {
    return { type: 'out_for_delivery', location }
  },

  delivered(deliveredAt: Date = new Date()): ShipmentStatus {
    return { type: 'delivered', deliveredAt }
  },

  exception(reason: string): ShipmentStatus {
    return { type: 'exception', reason }
  },

  failedAttempt(attemptedAt: Date = new Date()): ShipmentStatus {
    return { type: 'failed_attempt', attemptedAt }
  },

  /**
   * Create from string (lenient - defaults to pending)
   */
  create(value: string): Result<ShipmentStatus, ValidationError> {
    if (!value || typeof value !== 'string') {
      return Err(new ValidationError('Status is required'))
    }

    const normalized = value.toLowerCase()
    
    switch (normalized) {
      case 'pending':
        return Ok(ShipmentStatus.pending())
      case 'in_transit':
        return Ok(ShipmentStatus.inTransit())
      case 'out_for_delivery':
        return Ok(ShipmentStatus.outForDelivery())
      case 'delivered':
        return Ok(ShipmentStatus.delivered())
      case 'exception':
        return Ok(ShipmentStatus.exception('Unknown exception'))
      case 'failed_attempt':
        return Ok(ShipmentStatus.failedAttempt())
      default:
        // Default to pending for unknown statuses (lenient)
        return Ok(ShipmentStatus.pending())
    }
  },

  /**
   * Create with strict validation (fails on unknown status)
   */
  createStrict(value: string): Result<ShipmentStatus, ValidationError> {
    const result = ShipmentStatus.create(value)
    if (!result.success) return result
    
    const normalized = value.toLowerCase()
    const validStatuses = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'failed_attempt']
    
    if (!validStatuses.includes(normalized)) {
      return Err(new ValidationError(`Invalid status: ${value}`))
    }
    
    return result
  },

  /**
   * Convert to string representation
   */
  toString(status: ShipmentStatus): string {
    return status.type
  },

  /**
   * Pattern matching (exhaustive)
   */
  match<R>(
    status: ShipmentStatus,
    cases: {
      pending: () => R
      in_transit: (location?: string) => R
      out_for_delivery: (location?: string) => R
      delivered: (deliveredAt: Date) => R
      exception: (reason: string) => R
      failed_attempt: (attemptedAt: Date) => R
    }
  ): R {
    switch (status.type) {
      case 'pending':
        return cases.pending()
      case 'in_transit':
        return cases.in_transit(status.location)
      case 'out_for_delivery':
        return cases.out_for_delivery(status.location)
      case 'delivered':
        return cases.delivered(status.deliveredAt)
      case 'exception':
        return cases.exception(status.reason)
      case 'failed_attempt':
        return cases.failed_attempt(status.attemptedAt)
    }
  },

  /**
   * Business logic predicates
   */
  isDelivered(status: ShipmentStatus): boolean {
    return status.type === 'delivered'
  },

  isPending(status: ShipmentStatus): boolean {
    return status.type === 'pending'
  },

  isInTransit(status: ShipmentStatus): boolean {
    return status.type === 'in_transit' || status.type === 'out_for_delivery'
  },

  hasException(status: ShipmentStatus): boolean {
    return status.type === 'exception' || status.type === 'failed_attempt'
  },

  canTransitionTo(from: ShipmentStatus, to: ShipmentStatus): boolean {
    // Can always transition to exception from any status
    if (ShipmentStatus.hasException(to)) {
      return true
    }
    
    // Can't change status after delivered (except to exception, handled above)
    if (ShipmentStatus.isDelivered(from)) {
      return false
    }
    
    return true
  },

  /**
   * Check equality
   */
  equals(a: ShipmentStatus, b: ShipmentStatus): boolean {
    return a.type === b.type
  },

  /**
   * Check if status is an exception
   */
  isException(status: ShipmentStatus): boolean {
    return status.type === 'exception'
  },

  /**
   * Check if shipment is active (not delivered or exceptional)
   */
  isActive(status: ShipmentStatus): boolean {
    return !ShipmentStatus.isDelivered(status) && !ShipmentStatus.hasException(status)
  },

  /**
   * Check if status is terminal (delivered or failed)
   */
  isTerminal(status: ShipmentStatus): boolean {
    return status.type === 'delivered' || status.type === 'exception'
  }
}
