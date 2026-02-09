/**
 * E2E tests for Shipments API
 * Tests the full API route handlers
 */

import { describe, it, expect } from 'vitest'
import { GET, POST } from '@/app/api/shipments/route'
import { createMockRequest, assertResponse } from '../../helpers/api'
import { createTestShipment, createTestShipments } from '../../helpers/db'
import { SAMPLE_SHIPMENTS } from '../../fixtures/shipments'

describe('GET /api/shipments', () => {
  it('should return all shipments', async () => {
    // Arrange
    await createTestShipments(3, SAMPLE_SHIPMENTS.pending)

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
    // Arrange
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
    // Arrange
    await createTestShipments(10, SAMPLE_SHIPMENTS.pending)

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/shipments?limit=5',
    })

    // Act
    const response = await GET(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data).toHaveLength(5)
  })
})

describe('POST /api/shipments', () => {
  it('should create a new shipment', async () => {
    // Arrange
    const trackingNumber = `TEST${Date.now()}`
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/shipments',
      body: {
        trackingNumber,
        carrier: 'ups',
        poNumber: 'PO-12345',
        supplier: 'Test Supplier',
      },
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 201)

    // Assert
    expect(data).toHaveProperty('id')
    expect(data.trackingNumber).toBe(trackingNumber)
    expect(data.carrier).toBe('ups')
    expect(data.poNumber).toBe('PO-12345')
    expect(data.status).toBe('pending')
  })

  it('should validate required tracking number', async () => {
    // Arrange
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/shipments',
      body: {
        carrier: 'ups',
        // Missing trackingNumber
      },
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('should prevent duplicate tracking numbers', async () => {
    // Arrange
    const trackingNumber = `TEST${Date.now()}`
    await createTestShipment({
      tracking_number: trackingNumber,
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/shipments',
      body: {
        trackingNumber,
        carrier: 'ups',
      },
    })

    // Act
    const response = await POST(request)

    // Assert - Should either update or return error
    expect([200, 409]).toContain(response.status)
  })
})
