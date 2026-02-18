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

## Environment Setup

### URL Configuration

| Environment | App URL | Knock `app_base_url` |
|-------------|---------|---------------------|
| Production | `https://tracking.stitchi.co` | Same |
| Preview/Staging | `https://tracking-dashboard-git-*.vercel.app` | Vercel preview URL |
| Local | `http://localhost:3000` | `https://stitchi-tracking-dev.ngrok.app` |

### 1. Vercel Environment Variables

Already configured:
- `KNOCK_API_KEY` — Knock secret key (all environments)
- `APP_BASE_URL` — App's public URL (all environments)

### 2. Knock Dashboard Variables

Set in [Knock Dashboard](https://dashboard.knock.app/stitchi/settings/variables):

| Knock Environment | `app_base_url` Value |
|-------------------|---------------------|
| Development | `https://stitchi-tracking-dev.ngrok.app` |
| Production | `https://tracking.stitchi.co` |

### 3. Knock Workflow

The workflow `customer-tracking-update` is defined in `.knock/workflows/` and managed via CLI:

```bash
# Push workflow to Knock
npx knock workflow push customer-tracking-update

# Commit changes
npx knock commit -m "Add customer tracking workflow"

# Promote to production
npx knock commit promote --to production
```

### Local Development

Start ngrok with stable domain:

```bash
ngrok http 3000 --domain=stitchi-tracking-dev.ngrok.app
```

This exposes `localhost:3000` at `https://stitchi-tracking-dev.ngrok.app`, which matches the Knock Development environment's `app_base_url`.

### How It Works

1. Shipment status changes → triggers Knock workflow
2. Knock's HTTP fetch step calls `{{vars.app_base_url}}/api/webhooks/knock/customer-notification`
3. Our webhook sends notification via Front

The `app_base_url` variable resolves differently per Knock environment, so the same workflow works everywhere.

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

## Catch-up Notifications

When a thread is linked *after* shipment status changes have occurred, catch-up notifications are sent automatically.

### Flow

```
Thread manually linked
        │
        ▼
ThreadLinked domain event
        │
        ▼
catchup-notification.handler
        │
        ├── Query POs for order
        ├── Query shipments for POs
        ├── For each shipment:
        │     ├── Get current status
        │     ├── Check audit: was notification sent?
        │     └── If not → trigger via Knock
        │
        ▼
Catch-up notifications sent
```

### Example

1. Order 199 has shipment with status `delivered`
2. No thread linked → notification skipped
3. User manually links thread to Order 199
4. `ThreadLinked` event fires
5. Handler finds shipment, sees no `delivered` notification was sent
6. Triggers catch-up `delivered` notification via Knock
7. Customer receives "Your package has been delivered!" in Front thread

### Audit Trail

Catch-up notifications include `isCatchup: true` in metadata for debugging.

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
