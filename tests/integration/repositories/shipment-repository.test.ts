/**
 * Integration tests for Shipment Repository
 * Tests database operations
 */

import { describe, it, expect } from 'vitest'
import { getShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import { TrackingNumber as TN } from '@/lib/domain/value-objects/TrackingNumber'
import { ShipmentStatus as SS } from '@/lib/domain/value-objects/ShipmentStatus'
import { createTestShipment } from '../../helpers/db'
import { SAMPLE_SHIPMENTS } from '../../fixtures/shipments'

describe('PrismaShipmentRepository', () => {
  const repository = getShipmentRepository()

  describe('findById', () => {
    it('should find shipment by id', async () => {
      // Arrange
      const dbShipment = await createTestShipment(SAMPLE_SHIPMENTS.pending)

      // Act
      const shipment = await repository.findById(dbShipment.id)

      // Assert
      expect(shipment).toBeDefined()
      expect(shipment?.id).toBe(dbShipment.id)
      expect(TN.toString(shipment!.trackingNumber)).toBe(dbShipment.tracking_number)
    })

    it('should return null for non-existent id', async () => {
      // Act
      const shipment = await repository.findById(99999)

      // Assert
      expect(shipment).toBeNull()
    })
  })

  describe('findByTrackingNumber', () => {
    it('should find shipment by tracking number', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      await createTestShipment({
        ...SAMPLE_SHIPMENTS.pending,
        tracking_number: trackingNumber,
      })

      // Act
      const shipment = await repository.findByTrackingNumber(
        TN.create(trackingNumber).value
      )

      // Assert
      expect(shipment).toBeDefined()
      expect(TN.toString(shipment!.trackingNumber)).toBe(trackingNumber)
    })

    it('should return null for non-existent tracking number', async () => {
      // Act
      const shipment = await repository.findByTrackingNumber(
        TN.create('NONEXISTENT123').value
      )

      // Assert
      expect(shipment).toBeNull()
    })
  })

  describe('save', () => {
    it('should create new shipment', async () => {
      // Arrange
      const trackingNumber = TN.create(`TEST${Date.now()}`).value
      const shipment = S.create({
        trackingNumber,
        status: SS.pending(),
        carrier: 'ups',
        poNumber: 'PO-12345',
      })

      // Act
      const saved = await repository.save(shipment)

      // Assert
      expect(saved.id).toBeGreaterThan(0)
      expect(TN.toString(saved.trackingNumber)).toBe(TN.toString(trackingNumber))
    })

    it('should update existing shipment', async () => {
      // Arrange
      const trackingNumber = `TEST${Date.now()}`
      const dbShipment = await createTestShipment({
        tracking_number: trackingNumber,
        status: 'pending',
      })

      const shipment = await repository.findById(dbShipment.id)
      const updated = S.withTracking(shipment!, {
        status: SS.inTransit(null),
      })

      // Act
      const saved = await repository.save(updated)

      // Assert
      expect(saved.id).toBe(dbShipment.id)
      expect(SS.toString(saved.status)).toBe('in_transit')
    })
  })
})
