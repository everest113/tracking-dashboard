/**
 * E2E tests for Ship24 Webhook
 */

import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/webhooks/ship24/route'
import { createMockRequest } from '../../helpers/api'
import { createTestShipment } from '../../helpers/db'
import { SAMPLE_SHIP24_WEBHOOKS } from '../../fixtures/shipments'
import crypto from 'crypto'

// Mock signature generation (same as Ship24 uses)
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

describe('POST /api/webhooks/ship24', () => {
  const webhookSecret = process.env.SHIP24_WEBHOOK_SIGNING_SECRET || 'test_secret'

  it('should process webhook with valid signature', async () => {
    // Arrange
    const trackerId = 'test_tracker_' + Date.now()
    await createTestShipment({
      ship24_tracker_id: trackerId,
      tracking_number: 'TEST' + Date.now(),
      status: 'pending',
    })

    const payload = {
      ...SAMPLE_SHIP24_WEBHOOKS.status_update,
      data: {
        trackings: [
          {
            ...SAMPLE_SHIP24_WEBHOOKS.status_update.data.trackings[0],
            tracker: {
              trackerId,
              trackingNumber: 'TEST' + Date.now(),
            },
          },
        ],
      },
    }

    const payloadString = JSON.stringify(payload)
    const signature = generateSignature(payloadString, webhookSecret)

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/webhooks/ship24',
      body: payload,
      headers: {
        'x-ship24-signature': signature,
      },
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('should reject webhook with invalid signature', async () => {
    // Arrange
    const payload = SAMPLE_SHIP24_WEBHOOKS.status_update

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/webhooks/ship24',
      body: payload,
      headers: {
        'x-ship24-signature': 'invalid_signature',
      },
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(401)
  })

  it('should reject webhook without signature', async () => {
    // Arrange
    const payload = SAMPLE_SHIP24_WEBHOOKS.status_update

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/webhooks/ship24',
      body: payload,
      // No signature header
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(401)
  })
})
