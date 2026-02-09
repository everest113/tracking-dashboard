/**
 * Test fixtures for shipments
 * Reusable test data
 */

import type { Prisma } from '@prisma/client'

/**
 * Sample tracking numbers (valid format)
 */
export const TRACKING_NUMBERS = {
  UPS: '1Z999AA10123456784',
  FEDEX: '123456789012',
  USPS: '9400100000000000000000',
  DHL: '1234567890',
}

/**
 * Sample shipment data
 */
export const SAMPLE_SHIPMENTS = {
  pending: {
    tracking_number: TRACKING_NUMBERS.UPS,
    carrier: 'ups',
    status: 'pending',
    po_number: 'PO-12345',
    supplier: 'Acme Corp',
  } as Partial<Prisma.shipmentsCreateInput>,

  in_transit: {
    tracking_number: TRACKING_NUMBERS.FEDEX,
    carrier: 'fedex',
    status: 'in_transit',
    po_number: 'PO-12346',
    supplier: 'XYZ Supplies',
    shipped_date: new Date('2024-02-01'),
    estimated_delivery: new Date('2024-02-10'),
  } as Partial<Prisma.shipmentsCreateInput>,

  delivered: {
    tracking_number: TRACKING_NUMBERS.USPS,
    carrier: 'usps',
    status: 'delivered',
    po_number: 'PO-12347',
    supplier: 'Global Shipping',
    shipped_date: new Date('2024-01-25'),
    estimated_delivery: new Date('2024-02-01'),
    delivered_date: new Date('2024-02-01'),
  } as Partial<Prisma.shipmentsCreateInput>,

  with_tracker: {
    tracking_number: TRACKING_NUMBERS.DHL,
    carrier: 'dhl',
    status: 'in_transit',
    po_number: 'PO-12348',
    supplier: 'DHL Test',
    ship24_tracker_id: 'test_tracker_123',
  } as Partial<Prisma.shipmentsCreateInput>,
}

/**
 * Sample tracking events
 */
export const SAMPLE_TRACKING_EVENTS = {
  pickup: {
    status: 'picked_up',
    location: 'Origin Facility, CA',
    message: 'Package picked up',
    event_time: new Date('2024-02-01T10:00:00Z'),
  },

  in_transit: {
    status: 'in_transit',
    location: 'Distribution Center, NV',
    message: 'Package in transit',
    event_time: new Date('2024-02-02T14:30:00Z'),
  },

  out_for_delivery: {
    status: 'out_for_delivery',
    location: 'Local Post Office, NY',
    message: 'Out for delivery',
    event_time: new Date('2024-02-03T08:00:00Z'),
  },

  delivered: {
    status: 'delivered',
    location: 'Destination Address, NY',
    message: 'Delivered to mailbox',
    event_time: new Date('2024-02-03T15:45:00Z'),
  },
}

/**
 * Sample email messages for extraction tests
 */
export const SAMPLE_EMAILS = {
  with_tracking: {
    subject: 'Your order has shipped',
    body: `Your order has been shipped!
    
Tracking Number: ${TRACKING_NUMBERS.UPS}
Carrier: UPS
Estimated Delivery: February 10, 2024

Thank you for your order!`,
    senderEmail: 'ship@acme.com',
    senderName: 'Acme Corp',
  },

  multiple_tracking: {
    subject: 'Multiple shipments',
    body: `Your order has been split into multiple shipments:

Shipment 1: ${TRACKING_NUMBERS.UPS} (UPS)
Shipment 2: ${TRACKING_NUMBERS.FEDEX} (FedEx)

All items will arrive by February 15, 2024.`,
    senderEmail: 'ship@supplier.com',
    senderName: 'Supplier Co',
  },

  no_tracking: {
    subject: 'Order confirmation',
    body: 'Thank you for your order! We will send tracking info once shipped.',
    senderEmail: 'orders@shop.com',
    senderName: 'Shop Inc',
  },
}

/**
 * Sample Ship24 webhook payloads
 */
export const SAMPLE_SHIP24_WEBHOOKS = {
  status_update: {
    event: 'tracking_update',
    data: {
      trackings: [
        {
          tracker: {
            trackerId: 'test_tracker_123',
            trackingNumber: TRACKING_NUMBERS.UPS,
          },
          shipment: {
            statusMilestone: 'in_transit',
            statusCode: 'IT',
            statusCategory: 'InTransit',
            status: 'Package is in transit',
            trackingNumbers: [TRACKING_NUMBERS.UPS],
          },
          events: [
            {
              datetime: '2024-02-02T14:30:00Z',
              status: 'In Transit',
              location: 'Distribution Center',
              message: 'Package in transit to destination',
            },
          ],
        },
      ],
    },
  },

  delivered: {
    event: 'tracking_update',
    data: {
      trackings: [
        {
          tracker: {
            trackerId: 'test_tracker_123',
            trackingNumber: TRACKING_NUMBERS.UPS,
          },
          shipment: {
            statusMilestone: 'delivered',
            statusCode: 'DE',
            statusCategory: 'Delivered',
            status: 'Package delivered',
            deliveryDate: '2024-02-03T15:45:00Z',
          },
          events: [
            {
              datetime: '2024-02-03T15:45:00Z',
              status: 'Delivered',
              location: 'Destination',
              message: 'Package delivered',
            },
          ],
        },
      ],
    },
  },
}
