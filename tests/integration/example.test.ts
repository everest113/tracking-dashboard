/**
 * Example integration test
 * Demonstrates test setup and basic patterns
 */

import { describe, it, expect } from 'vitest'
import { createTestShipment, getAllShipments } from '../helpers/db'
import { SAMPLE_SHIPMENTS } from '../fixtures/shipments'

describe('Example Integration Test', () => {
  it('should create a test shipment', async () => {
    // Arrange & Act
    const shipment = await createTestShipment(SAMPLE_SHIPMENTS.pending)

    // Assert
    expect(shipment).toBeDefined()
    expect(shipment.id).toBeGreaterThan(0)
    expect(shipment.tracking_number).toBeTruthy()
  })

  it('should have clean database between tests', async () => {
    // This test should not see data from previous test
    const shipments = await getAllShipments()
    
    // Should be empty (cleaned by beforeEach in setup.ts)
    expect(shipments).toHaveLength(0)
  })

  it('should create multiple shipments', async () => {
    // Arrange
    await createTestShipment({ ...SAMPLE_SHIPMENTS.pending, tracking_number: 'TEST1' })
    await createTestShipment({ ...SAMPLE_SHIPMENTS.in_transit, tracking_number: 'TEST2' })
    await createTestShipment({ ...SAMPLE_SHIPMENTS.delivered, tracking_number: 'TEST3' })

    // Act
    const shipments = await getAllShipments()

    // Assert
    expect(shipments).toHaveLength(3)
  })
})
