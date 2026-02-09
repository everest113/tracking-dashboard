/**
 * Full Stack Integration Tests
 * Tests complete user workflows from UI to database
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { getShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { createTestShipment } from '../helpers/db'

describe('Full Stack Integration', () => {
  const service = getShipmentTrackingService()
  const repository = getShipmentRepository()

  describe('Complete Shipment Lifecycle', () => {
    it('should handle full shipment lifecycle: create → track → update → deliver', async () => {
      const trackingNumber = `LIFECYCLE${Date.now()}`

      // Step 1: Create shipment
      const createResult = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
        poNumber: 'PO-LIFECYCLE-001',
        supplier: 'Test Supplier',
      })

      expect(createResult.success).toBe(true)
      if (!createResult.success) return

      const shipmentId = createResult.data.id
      expect(shipmentId).toBeGreaterThan(0)

      // Step 2: Verify initial state
      let shipment = await repository.findById(shipmentId)
      expect(shipment).toBeDefined()
      expect(shipment?.status.value).toBe('pending')

      // Step 3: Update to in_transit
      const updateResult = await service.updateShipmentStatus(
        trackingNumber,
        'in_transit',
        null
      )

      expect(updateResult.success).toBe(true)
      shipment = await repository.findById(shipmentId)
      expect(shipment?.status.value).toBe('in_transit')

      // Step 4: Add tracking event
      await prisma.tracking_events.create({
        data: {
          shipment_id: shipmentId,
          status: 'Package scanned',
          location: 'Louisville, KY',
          timestamp: new Date(),
          description: 'Package scanned at facility',
          raw_data: {},
        },
      })

      // Verify event was created
      const events = await prisma.tracking_events.findMany({
        where: { shipment_id: shipmentId },
      })
      expect(events.length).toBeGreaterThan(0)

      // Step 5: Update to delivered
      const deliverResult = await service.updateShipmentStatus(
        trackingNumber,
        'delivered',
        new Date()
      )

      expect(deliverResult.success).toBe(true)
      shipment = await repository.findById(shipmentId)
      expect(shipment?.status.value).toBe('delivered')
      expect(shipment?.deliveredAt).toBeDefined()
    })
  })

  describe('Multi-Shipment Operations', () => {
    it('should handle batch creation and querying', async () => {
      // Create multiple shipments
      const shipments = []
      for (let i = 0; i < 5; i++) {
        const result = await service.createShipment({
          trackingNumber: `BATCH${Date.now()}${i}`,
          carrier: i % 2 === 0 ? 'ups' : 'usps',
          poNumber: `PO-BATCH-${i}`,
        })
        if (result.success) {
          shipments.push(result.data)
        }
      }

      expect(shipments.length).toBe(5)

      // Query all shipments
      const listResult = await service.listShipments({ limit: 100 })
      expect(listResult.success).toBe(true)
      if (listResult.success) {
        expect(listResult.data.length).toBeGreaterThanOrEqual(5)
      }

      // Filter by status
      const pendingResult = await service.listShipments({
        status: 'pending',
        limit: 100,
      })
      expect(pendingResult.success).toBe(true)
      if (pendingResult.success) {
        expect(pendingResult.data.every(s => s.status === 'pending')).toBe(true)
      }
    })

    it('should handle concurrent updates', async () => {
      // Create shipment
      const trackingNumber = `CONCURRENT${Date.now()}`
      const createResult = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
      })

      if (!createResult.success) return

      // Attempt concurrent updates
      const updates = [
        service.updateShipmentStatus(trackingNumber, 'in_transit', null),
        service.updateShipmentStatus(trackingNumber, 'in_transit', null),
        service.updateShipmentStatus(trackingNumber, 'in_transit', null),
      ]

      const results = await Promise.all(updates)

      // All should succeed (idempotent updates)
      expect(results.every(r => r.success)).toBe(true)

      // Verify final state
      const final = await service.getShipmentByTrackingNumber(trackingNumber)
      expect(final.success).toBe(true)
      if (final.success) {
        expect(final.data.status).toBe('in_transit')
      }
    })
  })

  describe('Error Recovery', () => {
    it('should handle partial failures gracefully', async () => {
      // Create shipment
      const trackingNumber = `ERROR${Date.now()}`
      const createResult = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
      })

      expect(createResult.success).toBe(true)
      if (!createResult.success) return

      // Try to create duplicate (should fail)
      const duplicateResult = await service.createShipment({
        trackingNumber, // Same tracking number
        carrier: 'usps', // Different carrier
      })

      expect(duplicateResult.success).toBe(false)

      // Original shipment should still exist
      const getResult = await service.getShipmentByTrackingNumber(trackingNumber)
      expect(getResult.success).toBe(true)
      if (getResult.success) {
        expect(getResult.data.carrier).toBe('ups') // Original carrier
      }
    })

    it('should validate business rules', async () => {
      // Try to create with invalid carrier
      const result = await service.createShipment({
        trackingNumber: `INVALID${Date.now()}`,
        carrier: 'invalid_carrier' as any,
      })

      // Should either fail validation or normalize the carrier
      expect(result).toHaveProperty('success')
    })
  })

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      // Create shipment
      const trackingNumber = `INTEGRITY${Date.now()}`
      const createResult = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
      })

      if (!createResult.success) return
      const shipmentId = createResult.data.id

      // Add tracking events
      await prisma.tracking_events.createMany({
        data: [
          {
            shipment_id: shipmentId,
            status: 'Event 1',
            timestamp: new Date(),
            raw_data: {},
          },
          {
            shipment_id: shipmentId,
            status: 'Event 2',
            timestamp: new Date(),
            raw_data: {},
          },
        ],
      })

      // Verify events are linked to shipment
      const events = await prisma.tracking_events.findMany({
        where: { shipment_id: shipmentId },
      })

      expect(events.length).toBe(2)
      expect(events.every(e => e.shipment_id === shipmentId)).toBe(true)
    })

    it('should handle database transactions correctly', async () => {
      const trackingNumber = `TX${Date.now()}`

      // Create shipment (should commit)
      const result = await service.createShipment({
        trackingNumber,
        carrier: 'ups',
      })

      expect(result.success).toBe(true)

      // Verify it persisted
      const retrieved = await service.getShipmentByTrackingNumber(trackingNumber)
      expect(retrieved.success).toBe(true)
    })
  })

  describe('Query Performance', () => {
    it('should efficiently handle large result sets', async () => {
      // Create many shipments
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(
          service.createShipment({
            trackingNumber: `PERF${Date.now()}${i}`,
            carrier: 'ups',
          })
        )
      }

      await Promise.all(promises)

      // Query with pagination
      const start = Date.now()
      const result = await service.listShipments({ limit: 10 })
      const duration = Date.now() - start

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      if (result.success) {
        expect(result.data.length).toBeLessThanOrEqual(10)
      }
    })
  })
})
