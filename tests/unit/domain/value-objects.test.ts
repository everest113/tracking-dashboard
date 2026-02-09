/**
 * Unit tests for Domain Value Objects
 * Tests business logic and validation rules
 */

import { describe, it, expect } from 'vitest'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'

describe('TrackingNumber Value Object', () => {
  describe('creation and validation', () => {
    it('should create valid tracking number', () => {
      const result = TrackingNumber.create('1Z999AA10123456784')
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(TrackingNumber.toString(result.value)).toBe('1Z999AA10123456784')
      }
    })

    it('should reject empty tracking number', () => {
      const result = TrackingNumber.create('')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should trim whitespace', () => {
      const result = TrackingNumber.create('  1Z999AA10123456784  ')
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(TrackingNumber.toString(result.value)).toBe('1Z999AA10123456784')
      }
    })

    it('should normalize tracking number format', () => {
      const result = TrackingNumber.create('1z999aa10123456784') // lowercase
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(TrackingNumber.toString(result.value)).toBe('1Z999AA10123456784')
      }
    })
  })

  describe('equality', () => {
    it('should treat same tracking numbers as equal', () => {
      const tn1 = TrackingNumber.create('1Z999AA10123456784')
      const tn2 = TrackingNumber.create('1Z999AA10123456784')
      
      expect(tn1.success && tn2.success).toBe(true)
      if (tn1.success && tn2.success) {
        expect(TrackingNumber.equals(tn1.value, tn2.value)).toBe(true)
      }
    })

    it('should treat different tracking numbers as not equal', () => {
      const tn1 = TrackingNumber.create('1Z999AA10123456784')
      const tn2 = TrackingNumber.create('1Z999AA10123456789')
      
      expect(tn1.success && tn2.success).toBe(true)
      if (tn1.success && tn2.success) {
        expect(TrackingNumber.equals(tn1.value, tn2.value)).toBe(false)
      }
    })
  })
})

describe('ShipmentStatus Value Object', () => {
  describe('status creation', () => {
    it('should create pending status', () => {
      const status = ShipmentStatus.pending()
      
      expect(ShipmentStatus.toString(status)).toBe('pending')
      expect(ShipmentStatus.isPending(status)).toBe(true)
    })

    it('should create in_transit status', () => {
      const status = ShipmentStatus.inTransit(null)
      
      expect(ShipmentStatus.toString(status)).toBe('in_transit')
      expect(ShipmentStatus.isInTransit(status)).toBe(true)
    })

    it('should create delivered status with date', () => {
      const deliveredAt = new Date('2024-01-15')
      const status = ShipmentStatus.delivered(deliveredAt)
      
      expect(ShipmentStatus.toString(status)).toBe('delivered')
      expect(ShipmentStatus.isDelivered(status)).toBe(true)
    })

    it('should create exception status', () => {
      const status = ShipmentStatus.exception('Test exception')
      
      expect(ShipmentStatus.toString(status)).toBe('exception')
      expect(ShipmentStatus.isException(status)).toBe(true)
    })
  })

  describe('status transitions', () => {
    it('should allow pending → in_transit', () => {
      const pending = ShipmentStatus.pending()
      const inTransit = ShipmentStatus.inTransit(null)
      
      expect(ShipmentStatus.canTransitionTo(pending, inTransit)).toBe(true)
    })

    it('should allow in_transit → delivered', () => {
      const inTransit = ShipmentStatus.inTransit(null)
      const delivered = ShipmentStatus.delivered(new Date())
      
      expect(ShipmentStatus.canTransitionTo(inTransit, delivered)).toBe(true)
    })

    it('should not allow delivered → in_transit', () => {
      const delivered = ShipmentStatus.delivered(new Date())
      const inTransit = ShipmentStatus.inTransit(null)
      
      expect(ShipmentStatus.canTransitionTo(delivered, inTransit)).toBe(false)
    })

    it('should allow any status → exception', () => {
      const statuses = [
        ShipmentStatus.pending(),
        ShipmentStatus.inTransit(null),
        ShipmentStatus.delivered(new Date()),
      ]
      
      const exception = ShipmentStatus.exception('Test exception')
      
      statuses.forEach(status => {
        expect(ShipmentStatus.canTransitionTo(status, exception)).toBe(true)
      })
    })
  })

  describe('status properties', () => {
    it('should identify active shipments', () => {
      expect(ShipmentStatus.isActive(ShipmentStatus.pending())).toBe(true)
      expect(ShipmentStatus.isActive(ShipmentStatus.inTransit(null))).toBe(true)
      expect(ShipmentStatus.isActive(ShipmentStatus.delivered(new Date()))).toBe(false)
    })

    it('should identify terminal statuses', () => {
      expect(ShipmentStatus.isTerminal(ShipmentStatus.pending())).toBe(false)
      expect(ShipmentStatus.isTerminal(ShipmentStatus.inTransit(null))).toBe(false)
      expect(ShipmentStatus.isTerminal(ShipmentStatus.delivered(new Date()))).toBe(true)
    })
  })
})
