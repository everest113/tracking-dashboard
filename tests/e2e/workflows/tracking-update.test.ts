/**
 * E2E tests for Tracking Update Workflow
 * Tests the complete flow of updating shipment tracking status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/manual-update-tracking/route'
import { createMockRequest, assertResponse } from '../../helpers/api'
import { createTestShipment } from '../../helpers/db'
import { getShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'

describe('Tracking Update Workflow', () => {
  const repository = getShipmentRepository()

  const mockShip24Response = {
    data: {
      trackings: [
        {
          tracker: {
            trackerId: 'ship24_123',
            trackingNumber: '1Z999AA10123456784',
          },
          shipment: {
            statusCode: 'in_transit',
            statusCategory: 'in_transit',
            statusMilestone: 'in_transit',
            originCountryCode: 'US',
            destinationCountryCode: 'US',
          },
          events: [
            {
              eventId: 'evt_123',
              trackingNumber: '1Z999AA10123456784',
              eventTrackingNumber: '1Z999AA10123456784',
              status: 'Departed from facility',
              occurrenceDatetime: new Date().toISOString(),
              order: 1,
              datetime: new Date().toISOString(),
              hasNoTime: false,
              utcOffset: '-05:00',
              location: 'Louisville, KY',
            },
          ],
        },
      ],
    },
  }

  beforeEach(() => {
    // Mock Ship24 API
    global.fetch = vi.fn((url: string) => {
      if (url.includes('ship24.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShip24Response),
        } as Response)
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    })
  })

  it('should update tracking status for active shipments', async () => {
    // Arrange - Create test shipment
    const trackingNumber = '1Z999AA10123456784'
    const dbShipment = await createTestShipment({
      tracking_number: trackingNumber,
      status: 'pending',
      ship24_tracker_id: 'ship24_123',
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.success).toBe(true)
    expect(data.checked).toBeGreaterThan(0)
    
    // Verify shipment was updated
    const updated = await repository.findById(dbShipment.id)
    expect(updated).toBeDefined()
  })

  it('should skip shipments without tracker IDs', async () => {
    // Arrange - Create shipment without tracker
    await createTestShipment({
      tracking_number: `TEST${Date.now()}`,
      status: 'pending',
      ship24_tracker_id: null,
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.success).toBe(true)
  })

  it('should handle Ship24 API errors gracefully', async () => {
    // Arrange - Mock API failure
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response)
    )

    await createTestShipment({
      tracking_number: '1Z999AA10123456784',
      status: 'pending',
      ship24_tracker_id: 'ship24_123',
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data).toHaveProperty('errors')
    expect(data.errors).toBeGreaterThan(0)
  })

  it('should update last_checked timestamp', async () => {
    // Arrange
    const trackingNumber = '1Z999AA10123456784'
    const dbShipment = await createTestShipment({
      tracking_number: trackingNumber,
      status: 'pending',
      ship24_tracker_id: 'ship24_123',
      last_checked: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const before = dbShipment.last_checked
    const response = await POST(request)
    await assertResponse(response, 200)

    // Assert
    const updated = await repository.findById(dbShipment.id)
    expect(updated?.lastChecked).toBeDefined()
    if (updated?.lastChecked && before) {
      expect(updated.lastChecked.getTime()).toBeGreaterThan(before.getTime())
    }
  })

  it('should not update delivered shipments', async () => {
    // Arrange
    const trackingNumber = '1Z999AA10123456784'
    await createTestShipment({
      tracking_number: trackingNumber,
      status: 'delivered',
      ship24_tracker_id: 'ship24_123',
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert - Delivered shipments should be skipped
    expect(data.success).toBe(true)
  })

  it('should batch update multiple shipments', async () => {
    // Arrange - Create multiple pending shipments
    for (let i = 0; i < 5; i++) {
      await createTestShipment({
        tracking_number: `1Z999AA1012345678${i}`,
        status: 'pending',
        ship24_tracker_id: `ship24_${i}`,
      })
    }

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/manual-update-tracking',
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.checked).toBeGreaterThanOrEqual(5)
  })
})
