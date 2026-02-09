import { Result, Ok, Err, ValidationError } from '../core/Result'

/**
 * TrackingNumber - Functional Value Object
 * Branded type for compile-time safety with zero runtime cost
 */
export type TrackingNumber = string & { readonly __brand: 'TrackingNumber' }

/**
 * TrackingNumber operations (pure functions)
 */
export const TrackingNumber = {
  /**
   * Create a validated TrackingNumber
   */
  create(value: string): Result<TrackingNumber, ValidationError> {
    if (!value || typeof value !== 'string') {
      return Err(new ValidationError('Tracking number is required'))
    }

    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    
    if (normalized.length < 3) {
      return Err(new ValidationError('Tracking number must be at least 3 characters'))
    }
    
    if (normalized.length > 100) {
      return Err(new ValidationError('Tracking number too long (max 100 characters)'))
    }
    
    return Ok(normalized as TrackingNumber)
  },

  /**
   * Create from trusted source (e.g., database) - skips validation
   */
  unsafe(value: string): TrackingNumber {
    return value as TrackingNumber
  },

  /**
   * Convert to string
   */
  toString(tn: TrackingNumber): string {
    return tn as string
  },

  /**
   * Check equality
   */
  equals(a: TrackingNumber, b: TrackingNumber): boolean {
    return a === b
  },

  /**
   * Check if value is a TrackingNumber (type guard)
   */
  is(value: unknown): value is TrackingNumber {
    return typeof value === 'string' && value.length >= 3 && value.length <= 100
  }
}
