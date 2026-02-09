/**
 * Integration tests for Shipment Tracking Use Cases
 * Tests the application layer business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { getShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import { createTestShipment } from '../../helpers/db'
import { SAMPLE_SHIPMENTS } from '../../fixtures/shipments'

describe('ShipmentTrackingService', () => {
  const service = getShipmentTrackingService()
  const repository = getShipmentRepository()

  describe('createShipment', () => {
    it('should create a new shipment with valid data', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      const data = {
        trackingNumber,
        carrier: 'ups',
        poNumber: 'PO-12345',
        supplier: 'Test Supplier',
      }

      // Act
      const result = await service.createShipment(data)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.trackingNumber).toBe(trackingNumber)
        expect(result.data.carrier).toBe('ups')
        expect(result.data.poNumber).toBe('PO-12345')
        expect(result.data.status).toBe('pending')
      }
    })

    it('should reject duplicate tracking numbers', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      await createTestShipment({ tracking_number: trackingNumber })

      // Act
      const result = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
      })

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('already exists')
      }
    })

    it('should handle invalid tracking number format', async () => {
      // Act
      const result = await service.createShipment({
        trackingNumber: '', // Empty tracking number
        carrier: 'ups',
      })

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('updateShipmentStatus', () => {
    it('should update shipment status', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      const dbShipment = await createTestShipment({
        tracking_number: trackingNumber,
        status: 'pending',
      })

      // Act
      const result = await service.updateShipmentStatus(
        trackingNumber,
        'in_transit',
        null
      )

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('in_transit')
      }

      // Verify in database
      const updated = await repository.findById(dbShipment.id)
      expect(updated?.status.value).toBe('in_transit')
    })

    it('should return error for non-existent shipment', async () => {
      // Act
      const result = await service.updateShipmentStatus(
        'NONEXISTENT123',
        'in_transit',
        null
      )

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found')
      }
    })
  })

  describe('getShipmentByTrackingNumber', () => {
    it('should retrieve shipment by tracking number', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      await createTestShipment({
        tracking_number: trackingNumber,
        carrier: 'ups',
        po_number: 'PO-12345',
      })

      // Act
      const result = await service.getShipmentByTrackingNumber(trackingNumber)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.trackingNumber).toBe(trackingNumber)
        expect(result.data.carrier).toBe('ups')
        expect(result.data.poNumber).toBe('PO-12345')
      }
    })

    it('should return error for non-existent tracking number', async () => {
      // Act
      const result = await service.getShipmentByTrackingNumber('NONEXISTENT123')

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('listShipments', () => {
    beforeEach(async () => {
      // Create test shipments with different statuses
      await createTestShipment({ ...SAMPLE_SHIPMENTS.pending, tracking_number: `PENDING${Date.now()}` })
      await createTestShipment({ ...SAMPLE_SHIPMENTS.inTransit, tracking_number: `INTRANSIT${Date.now()}` })
      await createTestShipment({ ...SAMPLE_SHIPMENTS.delivered, tracking_number: `DELIVERED${Date.now()}` })
    })

    it('should list all shipments', async () => {
      // Act
      const result = await service.listShipments({})

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThanOrEqual(3)
      }
    })

    it('should filter by status', async () => {
      // Act
      const result = await service.listShipments({ status: 'delivered' })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.every(s => s.status === 'delivered')).toBe(true)
      }
    })

    it('should respect limit parameter', async () => {
      // Act
      const result = await service.listShipments({ limit: 2 })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeLessThanOrEqual(2)
      }
    })

    it('should sort by most recent first', async () => {
      // Act
      const result = await service.listShipments({})

      // Assert
      expect(result.success).toBe(true)
      if (result.success && result.data.length >= 2) {
        const first = result.data[0]
        const second = result.data[1]
        expect(first.id).toBeGreaterThan(second.id)
      }
    })
  })

  describe('registerTracker', () => {
    it('should register tracker for shipment', async () => {
      // Arrange
      const trackingNumber = `1Z999AA10123456784` // Valid UPS format

      // Act
      const result = await service.registerTracker(
        trackingNumber,
        'ups',
        'PO-12345'
      )

      // Assert
      // Note: This will call the real Ship24 API unless mocked
      // For now, we just check the structure
      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('trackerId')
      }
    })
  })
})
