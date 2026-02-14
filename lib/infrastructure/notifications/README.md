# Knock Notifications

This directory contains the [Knock](https://knock.app) integration for sending notifications.

## Why Knock?

Instead of building our own notification infrastructure (templates, queues, channel adapters, preferences), we use Knock which handles all of this out of the box:

- **Multi-channel delivery** - Email, Slack, SMS, Push, In-App
- **Visual template editor** - Non-developers can edit templates
- **User preferences** - Built-in preference management
- **Retry & deliverability** - Knock handles failures and retries
- **Analytics** - Track delivery and engagement

## Setup

### 1. Create a Knock Account

Sign up at https://knock.app (free tier available)

### 2. Set Environment Variable

```bash
# .env.local
KNOCK_API_KEY=sk_your_secret_key_here
```

### 3. Create Workflows in Knock Dashboard

Create these workflows:

| Workflow Key | Trigger Event | Purpose |
|--------------|---------------|---------|
| `shipment-created` | New shipment added | Welcome/confirmation |
| `shipment-status-changed` | Status update | Progress notification |
| `shipment-delivered` | Delivery confirmed | Delivery notification |
| `shipment-exception` | Issue detected | Alert notification |

### 4. Configure Workflow Steps

Each workflow can have multiple channel steps:

- **Email** - Design with Knock's editor or import HTML
- **Slack** - Send to channels or DMs
- **SMS** - Via Twilio, MessageBird, etc.
- **Push** - iOS, Android, Web
- **In-App** - Notification feed component

## Data Available in Templates

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

### Example Email Template

```handlebars
Subject: Shipment {{trackingNumber}} - {{status}}

Hi {{recipient.name}},

Your shipment is now **{{status}}**.

- **Tracking:** {{trackingNumber}}
- **Carrier:** {{carrier}}
{{#if poNumber}}- **PO:** {{poNumber}}{{/if}}

Track your package: [View Status](https://track.example.com/{{trackingNumber}})
```

## Development Mode

Without `KNOCK_API_KEY`:
- Notifications log to console
- No external API calls
- Safe for local development

## Adding Recipients

Edit `getRecipientsForShipment()` in `registerHandlers.ts` to look up actual users:

```typescript
function getRecipientsForShipment(payload: ShipmentEventPayload): string[] {
  // Look up customer from order
  const customer = await getCustomerByPO(payload.current.poNumber)
  return customer ? [customer.id] : []
}
```

Recipients must be identified in Knock first:

```typescript
import { identifyUser } from '@/lib/infrastructure/notifications/knock'

await identifyUser('customer-123', {
  email: 'customer@example.com',
  name: 'Jane Doe',
})
```
