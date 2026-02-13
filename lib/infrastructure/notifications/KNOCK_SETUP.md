# Knock Integration Setup

This document describes how to configure and use Knock for notifications.

## Prerequisites

1. Create a Knock account at https://knock.app
2. Get your API keys from the Knock dashboard

## Environment Variables

Add to your `.env.local`:

```bash
KNOCK_API_KEY=sk_your_secret_key_here
```

## Required Workflows in Knock Dashboard

Create the following workflows in your Knock dashboard:

### 1. `shipment-created`
Triggered when a new shipment is created.

**Data available:**
- `trackingNumber` - The tracking number
- `carrier` - Carrier name (UPS, FedEx, etc.)
- `poNumber` - Purchase order number
- `status` - Current status

### 2. `shipment-status-changed`
Triggered when shipment status changes.

**Data available:**
- `trackingNumber`
- `status` - New status
- `previousStatus` - Old status
- `carrier`
- `poNumber`

### 3. `shipment-delivered`
Triggered when a shipment is marked as delivered.

**Data available:**
- `trackingNumber`
- `carrier`
- `poNumber`
- `deliveredDate` - ISO timestamp

### 4. `shipment-exception`
Triggered when a shipment has an exception (delay, issue, etc.).

**Data available:**
- `trackingNumber`
- `status`
- `carrier`
- `poNumber`

## Workflow Configuration Tips

In each Knock workflow, you can:

1. **Add channel steps** - Email, Slack, SMS, Push, In-App
2. **Configure templates** - Use Handlebars syntax with the data above
3. **Set conditions** - Only notify certain users based on data
4. **Add delays** - Batch or delay notifications

### Example Email Template

```handlebars
Subject: Shipment {{trackingNumber}} has been delivered!

Hi {{recipient.name}},

Great news! Your shipment has arrived.

**Tracking Number:** {{trackingNumber}}
**Carrier:** {{carrier}}
{{#if poNumber}}**PO Number:** {{poNumber}}{{/if}}

Thanks for your business!
```

## User Identification

To notify users, they must first be identified in Knock:

```typescript
import { identifyUser } from '@/lib/infrastructure/notifications/knock'

await identifyUser('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  phone_number: '+1234567890',
})
```

## Testing

Without `KNOCK_API_KEY` set:
- Notifications log to console but don't send
- Useful for local development

With `KNOCK_API_KEY` set:
- Notifications trigger real Knock workflows
- Use Knock's test mode or development environment
