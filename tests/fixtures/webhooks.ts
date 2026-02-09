/**
 * Sample webhook payloads for testing
 */

export const SAMPLE_WEBHOOKS = {
  trackingUpdate: {
    event: 'tracking.status.update',
    data: {
      trackerId: 'ship24_tracker_123',
      trackingNumber: '1Z999AA10123456784',
      status: 'in_transit',
      statusMilestone: 'in_transit',
      statusCategory: 'in_transit',
      originCountryCode: 'US',
      destinationCountryCode: 'US',
      events: [
        {
          eventId: 'evt_123',
          status: 'Departed from facility',
          location: 'Louisville, KY',
          datetime: '2024-01-15T10:30:00Z',
          description: 'Package departed from UPS facility',
        },
      ],
    },
  },

  trackingDelivered: {
    event: 'tracking.status.update',
    data: {
      trackerId: 'ship24_tracker_456',
      trackingNumber: '1Z999AA10123456789',
      status: 'delivered',
      statusMilestone: 'delivered',
      statusCategory: 'delivered',
      deliveryDate: '2024-01-16T14:25:00Z',
      signedBy: 'John Doe',
      events: [
        {
          eventId: 'evt_456',
          status: 'Delivered',
          location: 'Los Angeles, CA',
          datetime: '2024-01-16T14:25:00Z',
          description: 'Package delivered',
        },
      ],
    },
  },

  trackingException: {
    event: 'tracking.status.update',
    data: {
      trackerId: 'ship24_tracker_789',
      trackingNumber: '1Z999AA10123456790',
      status: 'exception',
      statusMilestone: 'exception',
      statusCategory: 'exception',
      exceptionMessage: 'Address unknown - unable to deliver',
      events: [
        {
          eventId: 'evt_789',
          status: 'Exception',
          location: 'Chicago, IL',
          datetime: '2024-01-17T09:00:00Z',
          description: 'Address unknown',
        },
      ],
    },
  },

  newTrackingEvent: {
    event: 'tracking.event.new',
    data: {
      trackerId: 'ship24_tracker_123',
      trackingNumber: '1Z999AA10123456784',
      event: {
        eventId: 'evt_new_001',
        status: 'In transit',
        location: 'Memphis, TN',
        datetime: '2024-01-15T12:00:00Z',
        description: 'Package scanned at sorting facility',
      },
    },
  },
}

export const INVALID_WEBHOOKS = {
  missingEvent: {
    data: {
      trackerId: 'ship24_tracker_123',
    },
  },

  missingData: {
    event: 'tracking.status.update',
  },

  invalidEventType: {
    event: 'invalid.event.type',
    data: {},
  },
}
