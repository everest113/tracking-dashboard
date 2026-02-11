# Ship24 Integration Setup

Complete guide to Ship24 tracking integration, data flow, and troubleshooting.

## Quick Setup

### 1. Add Environment Variables

```bash
# .env.local and Vercel environment variables
SHIP24_API_KEY=apik_your_key_here
SHIP24_WEBHOOK_SIGNING_SECRET=your_webhook_secret_from_ship24_dashboard
```

### 2. Configure Webhook in Ship24 Dashboard

1. Go to: https://dashboard.ship24.com/integrations/webhook/
2. Set webhook URL to:
   ```
   https://your-domain.vercel.app/api/webhooks/ship24
   ```
3. Copy the "Webhook Secret" and add to environment variables above
4. Click "Save"
5. Click "Send Test Webhook" to verify

### 3. Register Existing Shipments

In your dashboard UI, click the **"Register Trackers"** button to backfill existing shipments with Ship24.

---

## Database Schema

### Shipments Table - Complete Field List

| Field | Type | Source | Updated By | Description |
|-------|------|--------|------------|-------------|
| `tracking_number` | String | Email Extraction | Scan | Unique tracking number |
| `carrier` | String | Email Extraction | Scan | ups, usps, fedex, dhl, other |
| `po_number` | String | Email Extraction | Scan | Purchase order number |
| `supplier` | String | Email Extraction | Scan | Supplier/vendor name |
| `shipped_date` | DateTime | Email Extraction | Scan | Date package was shipped |
| `status` | String | Ship24 | Webhook/Cron | pending, in_transit, delivered, etc. |
| `origin` | String | Ship24 | Webhook/Cron | Origin location |
| `destination` | String | Ship24 | Webhook/Cron | Destination location |
| `estimated_delivery` | DateTime | Ship24 | Webhook/Cron | Expected delivery date |
| `delivered_date` | DateTime | Ship24 | Webhook/Cron | Actual delivery date |
| `ship24_tracker_id` | String | Ship24 API | Scan (registration) | Ship24 internal tracker ID |
| `ship24_status` | String | Ship24 | Webhook/Cron | Detailed Ship24 status |
| `ship24_last_update` | DateTime | Ship24 | Webhook/Cron | Last Ship24 update timestamp |
| `last_error` | String | Any | Scan/Cron | Last error for debugging |
| `last_checked` | DateTime | Ship24 | Cron | Last time we polled Ship24 |
| `front_conversation_id` | String | Front API | Scan | Link to Front email |

---

## Data Flow

### 1. Email Extraction (Front Scan)

```
Front Email → AI Extraction → Database
```

**Fields Populated:**
- `tracking_number` ✓
- `carrier` ✓
- `po_number` ✓
- `supplier` ✓
- `shipped_date` ✓
- `status` = "pending"
- `front_conversation_id` ✓

### 2. Ship24 Registration (Immediate)

```
Database → Ship24 API (Create Tracker) → Update Database
```

**What Happens:**
1. After creating shipment, call `service.registerTracker()`
2. Ship24 API returns tracker ID
3. Store `ship24_tracker_id` in database
4. If error, store in `last_error` field

### 3. Ship24 Updates (Cron Job)

```
Cron → Fetch Active Shipments → Ship24 API → Update Database
```

**Fields Updated:**
- `status` - General status (in_transit, delivered, etc.)
- `ship24_status` - Detailed Ship24 status
- `origin` - Origin location from tracking
- `destination` - Destination location
- `estimated_delivery` - ETA from carrier
- `delivered_date` - Actual delivery timestamp
- `last_checked` - Current timestamp
- `ship24_last_update` - Ship24's last update time
- `last_error` - Any API errors

**Cron Setup:**
```bash
# Vercel cron (vercel.json)
{
  "crons": [{
    "path": "/api/cron/update-tracking",
    "schedule": "0 */6 * * *"  // Every 6 hours
  }]
}
```

### 4. Ship24 Webhooks (Real-time)

```
Ship24 → Webhook Endpoint → Update Database
```

**Same fields as cron, but triggered by Ship24 when status changes.**

---

## Error Tracking

### Where Errors Are Stored

**`last_error` field:**
- Ship24 registration failures
- Ship24 API errors during updates
- Webhook processing errors
- Invalid tracking numbers
- Rate limit errors

**Example Errors:**
```
"Ship24 API key not configured"
"Tracking number not found"
"Rate limit exceeded: 60 requests/minute"
"Invalid carrier specified"
```

### How to Debug

**Check for failed registrations:**
```sql
SELECT tracking_number, carrier, last_error, created_at 
FROM shipments 
WHERE ship24_tracker_id IS NULL 
  AND last_error IS NOT NULL;
```

**Check for update errors:**
```sql
SELECT tracking_number, status, last_error, last_checked
FROM shipments
WHERE last_error IS NOT NULL
  AND last_checked > NOW() - INTERVAL '1 day';
```

---

## Status Types

### General Status (`status` field)
- `pending` - Not yet in Ship24 system
- `in_transit` - Package is moving
- `delivered` - Package delivered
- `exception` - Problem occurred
- `expired` - Tracking expired

### Ship24 Status (`ship24_status` field)
More granular:
- `InfoReceived`
- `InTransit`
- `OutForDelivery`
- `FailedAttempt`
- `Delivered`
- `AvailableForPickup`
- `Exception`

---

## Ship24 API Limits

| Plan | Trackers | Updates/Day |
|------|----------|-------------|
| Free | 100 | 100 |
| Starter | 500 | 500 |
| Growth | 2000 | 2000 |

**Current Strategy:**
- Register immediately when shipment created
- Poll active shipments via cron (configurable frequency)
- Webhooks for real-time updates (reduces API calls)

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/ship24` | Receive tracking updates from Ship24 |
| `POST /api/trackers/backfill` | Register all untracked shipments |
| `POST /api/manual-update-tracking` | Fetch latest cached results |

---

## Troubleshooting

### Shipments Not Registering with Ship24

**Check:**
1. Is `SHIP24_API_KEY` set in environment?
2. Check `last_error` field in database
3. Look for Ship24 registration errors in logs

**Common Issues:**
- Invalid API key
- Rate limit exceeded
- Carrier not supported
- Tracking number format invalid

### Status Not Updating

**Check:**
1. Is cron job running? (`/api/cron/update-tracking`)
2. Are webhooks configured? (`/api/webhooks/ship24`)
3. Check `last_checked` timestamp
4. Check `last_error` for API issues

### Webhook Returns 401

**Fix:**
- Ensure `SHIP24_WEBHOOK_SIGNING_SECRET` matches the value in Ship24 dashboard
- Redeploy if environment variable was updated

---

## Verification

Check tracker registration status:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(ship24_tracker_id) as registered,
  COUNT(*) - COUNT(ship24_tracker_id) as unregistered
FROM shipments;
```

---

## UI Display Recommendations

### Shipment Table Columns

**Current:**
- Tracking Number
- Carrier
- Status
- PO Number
- Supplier
- Last Checked

**Should Add:**
- **Shipped Date** - Show when package was shipped
- **Estimated Delivery** - Show ETA
- **Delivered Date** - Show actual delivery (if delivered)
- **Error** - Show last_error if present (with warning icon)
- **Ship24 Status** - More detailed than general status

---

**Docs:** https://docs.ship24.com/webhooks/overview  
**Dashboard:** https://dashboard.ship24.com
