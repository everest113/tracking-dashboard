# Customer Tracking Notifications

Send tracking updates to customers via Front conversation replies.

## Overview

When a shipment status changes, customers receive a notification in their existing Front conversation thread. This uses Knock for orchestration (idempotency, retries) and Front for delivery.

```
Ship24 Webhook
     │
     ▼
ShipmentStatusChanged event
     │
     ▼
Application Event Queue
     │
     ├──────────────────────────────┐
     │                              │
     ▼                              ▼
Internal Handler              Customer Handler
     │                              │
     ▼                              ▼
Knock Workflow              Knock Workflow
(team notifications)        (customer-tracking-update)
     │                              │
     ▼                              ▼
Email/Slack/Push            Webhook Channel
                                   │
                                   ▼
                            /api/webhooks/knock/customer-notification
                                   │
                                   ▼
                            TrackingNotificationService
                                   │
                                   ▼
                            Front API (reply to thread)
```

## Notification Types

| Type | Trigger | Customer Message |
|------|---------|------------------|
| `shipped` | Status changes from `pending` to `in_transit` | "Your order has shipped!" |
| `out_for_delivery` | Status becomes `out_for_delivery` | "Your package is out for delivery today!" |
| `delivered` | Status becomes `delivered` | "Your package has been delivered!" |
| `exception` | Status becomes `exception` | "There's been a delivery update..." |

## Knock Setup

### 1. Create Workflow

In [Knock Dashboard](https://dashboard.knock.app):

1. Create workflow: `customer-tracking-update`
2. Add a **Webhook** channel step
3. Configure the webhook:
   - **URL**: `https://your-domain.com/api/webhooks/knock/customer-notification`
   - **Method**: `POST`
   - **Headers**: `Content-Type: application/json`
   - **Body**: Use Knock's default payload (includes `data`, `recipient`, etc.)

### 2. Environment Variables

```bash
# .env.local
KNOCK_API_KEY=sk_your_secret_key
```

### 3. Webhook Security (Optional)

To verify Knock webhook signatures, add:

```bash
KNOCK_WEBHOOK_SECRET=your_webhook_signing_secret
```

## Requirements

For a notification to be sent:

1. ✅ Shipment has a PO number
2. ✅ PO is linked to an order
3. ✅ Order has a linked Front conversation (`front_conversation_id`)
4. ✅ Thread status is `auto_matched` or `manually_linked`

If any requirement is not met, the notification is **skipped** (logged in audit).

## Audit Trail

All notification attempts are logged to `audit_history`:

| Action | Status | Description |
|--------|--------|-------------|
| `notification.sent` | `success` | Notification delivered to Front |
| `notification.skipped` | `skipped` | Missing thread, wrong status, etc. |
| `notification.failed` | `failed` | Front API error |

Query example:
```sql
SELECT * FROM audit_history 
WHERE entity_type = 'shipment' 
  AND action LIKE 'notification.%'
ORDER BY created_at DESC;
```

## Idempotency

Knock handles idempotency via the `idempotencyKey`:

```
customer:{eventId}:{shipmentId}:{notificationType}
```

If the same notification is triggered twice (e.g., cron retry), Knock skips the duplicate.

## Testing

1. Create a test shipment with a PO linked to an order with a Front thread
2. Update the shipment status to `in_transit`
3. Run the event dispatcher: `GET /api/tasks/events`
4. Check:
   - Knock dashboard for workflow run
   - Audit history for notification record
   - Front conversation for the reply

## Catch-up Notifications

When a thread is manually linked *after* a status change:

1. `ThreadLinked` event fires
2. Handler queries shipments for that order
3. Checks which notifications were missed (via audit trail)
4. Triggers catch-up notifications

See PR 4 in the tracking notifications series.
