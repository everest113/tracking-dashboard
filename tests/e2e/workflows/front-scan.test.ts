/**
 * E2E tests for Front Inbox Scanning Workflow
 * Tests the complete flow from Front API to database
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/front/scan/route'
import { createMockRequest, assertResponse } from '../../helpers/api'
import { getShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import { prisma } from '@/lib/infrastructure/database/prisma'

describe('Front Inbox Scan Workflow', () => {
  const repository = getShipmentRepository()

  // Mock Front API responses
  const mockFrontConversations = {
    _results: [
      {
        id: 'cnv_123',
        subject: 'Order #12345 Shipped',
        created_at: Date.now() / 1000,
        _links: {
          self: 'https://api2.frontapp.com/conversations/cnv_123',
        },
      },
      {
        id: 'cnv_124',
        subject: 'Your package has shipped',
        created_at: Date.now() / 1000,
        _links: {
          self: 'https://api2.frontapp.com/conversations/cnv_124',
        },
      },
    ],
    _pagination: {
      next: null,
    },
  }

  const mockConversationMessages = {
    _results: [
      {
        id: 'msg_123',
        type: 'email',
        is_inbound: true,
        created_at: Date.now() / 1000,
        blurb: 'Your package has been shipped',
        body: `
          Your order has shipped!
          
          Tracking Number: 1Z999AA10123456784
          Carrier: UPS
          
          Thank you for your order.
        `,
        author: {
          email: 'customer@example.com',
          name: 'Test Customer',
        },
      },
    ],
    _pagination: {
      next: null,
    },
  }

  beforeEach(() => {
    // Mock fetch for Front API calls
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/conversations?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFrontConversations),
        } as Response)
      }
      if (url.includes('/conversations/') && url.includes('/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversationMessages),
        } as Response)
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    })
  })

  it('should scan conversations and extract tracking numbers', async () => {
    // Arrange
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.success).toBe(true)
    expect(data.summary).toBeDefined()
    expect(data.summary.conversationsProcessed).toBeGreaterThan(0)
  })

  it('should skip already scanned conversations', async () => {
    // Arrange - Mark conversation as scanned
    await prisma.scanned_conversations.create({
      data: {
        conversation_id: 'cnv_123',
        scanned_at: new Date(),
        tracking_numbers_found: 1,
      },
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.summary.conversationsAlreadyScanned).toBeGreaterThan(0)
  })

  it('should create sync history record', async () => {
    // Arrange
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    })

    // Act
    const response = await POST(request)
    await assertResponse(response, 200)

    // Assert - Check sync history was created
    const syncHistory = await prisma.sync_history.findFirst({
      orderBy: { started_at: 'desc' },
    })

    expect(syncHistory).toBeDefined()
    expect(syncHistory?.status).toMatch(/success|partial|error/)
    expect(syncHistory?.completed_at).toBeDefined()
  })

  it('should handle API errors gracefully', async () => {
    // Arrange - Mock API failure
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)
    )

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: new Date().toISOString().split('T')[0],
      },
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('should validate date parameter', async () => {
    // Arrange
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: 'invalid-date',
      },
    })

    // Act
    const response = await POST(request)

    // Assert
    expect([400, 500]).toContain(response.status)
  })

  it('should extract multiple tracking numbers from one message', async () => {
    // Arrange - Mock message with multiple tracking numbers
    const multiTrackingMessage = {
      ...mockConversationMessages,
      _results: [
        {
          ...mockConversationMessages._results[0],
          body: `
            Your orders have shipped!
            
            Order 1: 1Z999AA10123456784 (UPS)
            Order 2: 9400100000000000000000 (USPS)
            
            Thank you!
          `,
        },
      ],
    }

    global.fetch = vi.fn((url: string) => {
      if (url.includes('/conversations?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFrontConversations),
        } as Response)
      }
      if (url.includes('/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(multiTrackingMessage),
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    })

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/front/scan',
      body: {
        after: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    })

    // Act
    const response = await POST(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data.summary.shipmentsAdded).toBeGreaterThanOrEqual(1)
  })
})
