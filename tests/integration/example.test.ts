/**
 * Example Integration Test
 * Shows how to write integration tests with database access
 */

import { describe, it, expect } from 'vitest'
import { createTestShipment } from '../helpers/db'
import { prisma } from '@/lib/prisma'

describe('Example Integration Tests', () => {
  it('should create a test shipment', async () => {
    const shipment = await createTestShipment({
      tracking_number: `TEST${Date.now()}`,
      status: 'pending',
    })

    expect(shipment.id).toBeGreaterThan(0)
    expect(shipment.status).toBe('pending')

    // Verify it's in the database
    const dbShipment = await prisma.shipments.findUnique({
      where: { id: shipment.id },
    })

    expect(dbShipment).toBeDefined()
    expect(dbShipment?.tracking_number).toBe(shipment.tracking_number)
  })

  it('should have clean database between tests', async () => {
    // This test verifies that beforeEach cleanup works
    const count = await prisma.shipments.count()
    
    // Should only have shipments from this test (previous test cleaned up)
    expect(count).toBe(0)

    await createTestShipment({
      tracking_number: `CLEAN${Date.now()}`,
    })

    const newCount = await prisma.shipments.count()
    expect(newCount).toBe(1)
  })

  it.skip('should handle concurrent operations', async () => {
    // TODO: Test database transaction handling
    const promises = Array.from({ length: 5 }, (_, i) =>
      createTestShipment({
        tracking_number: `CONCURRENT${Date.now()}${i}`,
      })
    )

    const shipments = await Promise.all(promises)
    expect(shipments.length).toBe(5)
    expect(new Set(shipments.map(s => s.id)).size).toBe(5)
  })
})
