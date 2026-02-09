/**
 * E2E tests for Shipments API
 * Tests the full API route handlers
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/shipments/route'
import { createMockRequest, assertResponse } from '../../helpers/api'
import { createTestShipment, cleanDatabase } from '../../helpers/db'
import { SAMPLE_SHIPMENTS } from '../../fixtures/shipments'

describe('Shipments API', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  describe('GET /api/shipments', () => {
    it('should return all shipments', async () => {
      // Arrange - create shipments one by one
      await createTestShipment({ ...SAMPLE_SHIPMENTS.pending, tracking_number: 'TEST1' })
      await createTestShipment({ ...SAMPLE_SHIPMENTS.pending, tracking_number: 'TEST2' })
      await createTestShipment({ ...SAMPLE_SHIPMENTS.pending, tracking_number: 'TEST3' })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/shipments',
      })

      // Act
      const response = await GET(request)
      const data = await assertResponse(response, 200)

      // Assert
      expect(data).toBeInstanceOf(Array)
      expect(data.length).toBeGreaterThanOrEqual(3)
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('trackingNumber')
      expect(data[0]).toHaveProperty('status')
    })

    it('should return empty array when no shipments exist', async () => {
      // Arrange - no shipments created
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/shipments',
      })

      // Act
      const response = await GET(request)
      const data = await assertResponse(response, 200)

      // Assert
      expect(data).toEqual([])
    })

    it('should respect limit query parameter', async () => {
      // Arrange - create 10 shipments
      const shipments = []
      for (let i = 0; i < 10; i++) {
        const shipment = await createTestShipment({
          ...SAMPLE_SHIPMENTS.pending,
          tracking_number: `LIMIT_TEST_${Date.now()}_${i}`,
        })
        shipments.push(shipment)
      }

      // Verify shipments were created
      expect(shipments.length).toBe(10)

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/shipments?limit=5',
      })

      // Act
      const response = await GET(request)
      const data = await assertResponse(response, 200)

      // Assert
      expect(data.length).toBeLessThanOrEqual(5)
      expect(data.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/shipments', () => {
    it('should create a new shipment', async () => {
      // Arrange
      const newShipment = {
        trackingNumber: `NEW${Date.now()}`,
        carrier: 'ups',
        poNumber: 'PO-123',
        supplier: 'Test Supplier',
      }

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/shipments',
        body: newShipment,
      })

      // Act
      const response = await POST(request)
      const data = await assertResponse(response, 201)

      // Assert
      expect(data).toHaveProperty('id')
      expect(data.trackingNumber).toBe(newShipment.trackingNumber)
      expect(data.carrier).toBe(newShipment.carrier)
      expect(data.status).toBe('pending')
    })

    it('should validate required tracking number', async () => {
      // Arrange
      const invalidShipment = {
        carrier: 'ups',
      }

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/shipments',
        body: invalidShipment,
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(400)
    })

    it('should prevent duplicate tracking numbers', async () => {
      // Arrange
      const trackingNumber = `DUP${Date.now()}`
      await createTestShipment({ tracking_number: trackingNumber })

      const duplicateShipment = {
        trackingNumber,
        carrier: 'fedex',
      }

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/shipments',
        body: duplicateShipment,
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(409)
    })
  })
})
