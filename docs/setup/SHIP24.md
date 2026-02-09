# Ship24 Integration Setup

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

## How It Works

### Automatic Tracker Registration
When you add a shipment (via Front sync or manual entry), the system:
1. Creates shipment in database
2. Registers tracker with Ship24 API
3. Stores `ship24_tracker_id`
4. Ship24 starts tracking automatically

### Real-Time Webhook Updates
When Ship24 detects a status change:
1. Ship24 sends POST to `/api/webhooks/ship24`
2. Webhook verifies signature
3. Updates shipment status and tracking events
4. No polling needed!

### Manual Refresh
Click "Update Tracking" to fetch latest cached results from Ship24 (fast, no courier re-query).

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/ship24` | Receive tracking updates from Ship24 |
| `POST /api/trackers/backfill` | Register all untracked shipments |
| `POST /api/manual-update-tracking` | Fetch latest cached results |

## Troubleshooting

**Shipments not updating:**
- Check if `ship24_tracker_id` is set (click "Register Trackers" if not)
- Verify webhook URL in Ship24 dashboard
- Check `SHIP24_WEBHOOK_SIGNING_SECRET` matches

**Tracker registration fails:**
- Verify `SHIP24_API_KEY` is valid
- Check carrier codes match Ship24 format (lowercase: `ups`, `fedex`, `usps`)
- Review Vercel logs for specific errors

**Webhook returns 401:**
- Ensure `SHIP24_WEBHOOK_SIGNING_SECRET` matches the value in Ship24 dashboard
- Redeploy if environment variable was updated

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

**Docs:** https://docs.ship24.com/webhooks/overview  
**Dashboard:** https://dashboard.ship24.com
