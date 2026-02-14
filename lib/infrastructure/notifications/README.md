# Knock Notifications

This directory contains the [Knock](https://knock.app) integration for sending notifications.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KNOCK DATA MODEL                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Objects (Collection: "shipments")                           │
│  └── Shipment "ship_123"                                    │
│      ├── trackingNumber, status, carrier, etc.              │
│      └── Subscribers: [user-1, user-2, ...]                 │
│                                                              │
│  Users                                                       │
│  └── "user-1"                                               │
│      ├── email, name, phone_number                          │
│      └── timezone, locale, avatar                           │
│                                                              │
│  Tenants (optional)                                          │
│  └── Customer accounts for branding/scoping                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Shipment event fires (shipment.delivered)               │
│  2. Handler upserts shipment as Knock Object                │
│  3. Handler triggers workflow with shipment as recipient    │
│  4. Knock fans out to all subscribed users                  │
│  5. Users receive notifications on configured channels      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Objects & Subscriptions

Shipments are represented as **Knock Objects**. Users **subscribe** to shipments they want notifications for. When a workflow is triggered for a shipment, Knock automatically notifies all subscribers.

```typescript
import { 
  upsertShipmentObject, 
  subscribeToShipment,
  triggerShipmentWorkflow 
} from '@/lib/infrastructure/notifications/knock'

// 1. Sync shipment to Knock
await upsertShipmentObject('ship-123', {
  trackingNumber: '1Z999...',
  status: 'in_transit',
  carrier: 'UPS',
  // ...
})

// 2. Subscribe users who should receive notifications
await subscribeToShipment('ship-123', ['user-customer', 'user-csm'])

// 3. Trigger workflow - Knock notifies all subscribers
await triggerShipmentWorkflow('shipment-delivered', 'ship-123', {
  trackingNumber: '1Z999...',
  status: 'delivered',
  // ...
})
```

### Tenants (Multi-tenancy)

Pass a `tenant` to scope notifications to a customer account:

```typescript
await triggerShipmentWorkflow('shipment-delivered', 'ship-123', data, {
  tenant: 'acme-corp',  // Customer account ID
})
```

Benefits:
- Per-tenant branding in emails
- Scoped in-app notification feeds
- Per-tenant preference defaults

### Actors

Pass an `actor` when a user triggered the event:

```typescript
await triggerShipmentWorkflow('shipment-status-changed', 'ship-123', data, {
  actor: 'user-csm-123',  // CSM who updated the status
})
```

Benefits:
- Actor is excluded from notifications (they already know)
- Actor shown in notification: "Jane updated the shipment"
- Better audit trail

### Idempotency

Prevent duplicate notifications:

```typescript
await triggerShipmentWorkflow('shipment-delivered', 'ship-123', data, {
  idempotencyKey: `${eventId}:ship-123`,
})
```

## Setup

### 1. Create a Knock Account

Sign up at https://knock.app (free tier available)

### 2. Set Environment Variable

```bash
# .env.local
KNOCK_API_KEY=sk_your_secret_key_here
```

### 3. Create Workflows in Knock Dashboard

| Workflow Key | Trigger | Purpose |
|--------------|---------|---------|
| `shipment-created` | New shipment | Welcome/confirmation |
| `shipment-status-changed` | Status update | Progress notification |
| `shipment-delivered` | Delivery confirmed | Delivery notification |
| `shipment-exception` | Issue detected | Alert notification |

### 4. Configure Workflow Channels

Each workflow can have multiple channel steps:

- **Email** - Design with Knock's visual editor
- **Slack** - Send to channels or DMs
- **SMS** - Via Twilio, MessageBird, etc.
- **Push** - iOS, Android, Web
- **In-App** - Notification feed component

## Template Data

All shipment workflows receive:

```json
{
  "trackingNumber": "1Z999AA10123456784",
  "status": "delivered",
  "carrier": "UPS",
  "poNumber": "PO-12345",
  "previousStatus": "in_transit",
  "estimatedDelivery": "2024-01-15T00:00:00Z",
  "deliveredDate": "2024-01-14T14:30:00Z"
}
```

Access in templates:

```handlebars
Subject: Shipment {{trackingNumber}} - {{status}}

Hi {{recipient.name}},

Your shipment is now **{{status}}**.

- **Tracking:** {{trackingNumber}}
- **Carrier:** {{carrier}}
{{#if poNumber}}- **PO:** {{poNumber}}{{/if}}

Track your package: [View Status](https://example.com/track/{{trackingNumber}})
```

## API Reference

### Object Management

```typescript
// Upsert shipment object
await upsertShipmentObject(shipmentId, data)

// Delete shipment object
await deleteShipmentObject(shipmentId)
```

### Subscriptions

```typescript
// Subscribe users to shipment
await subscribeToShipment(shipmentId, ['user-1', 'user-2'])

// Unsubscribe users
await unsubscribeFromShipment(shipmentId, ['user-1'])

// Get subscribers
const { subscribers } = await getShipmentSubscribers(shipmentId)
```

### Users

```typescript
// Identify user with full properties
await identifyUser('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  phone_number: '+1234567890',
  timezone: 'America/New_York',
  locale: 'en-US',
  avatar: 'https://...',
  // Custom properties
  role: 'customer',
  company: 'Acme Corp',
})

// Delete user
await deleteUser('user-123')
```

### Workflow Triggers

```typescript
// Trigger for shipment (fans out to subscribers)
await triggerShipmentWorkflow(workflow, shipmentId, data, {
  tenant: 'acme-corp',
  actor: 'user-csm',
  idempotencyKey: 'unique-key',
  cancellationKey: 'cancel-key',
})

// Trigger for specific users
await triggerWorkflowForUsers(workflow, userIds, data, options)

// Cancel a workflow
await cancelWorkflow(workflow, cancellationKey, recipientIds)
```

## Development Mode

Without `KNOCK_API_KEY`:
- All functions succeed but log to console
- No external API calls
- Safe for local development

## Integration Points

### When to Subscribe Users

- Customer views/claims a shipment
- CSM is assigned to an account
- User enables notifications for a PO

### When to Identify Users

- User signs up
- User profile is updated
- User's email/phone changes

### When to Set Tenant

- All notifications for a customer account
- When brand customization is needed
- For scoped in-app feeds
