# ShipStation Tracking Integration

## Overview

The tracking dashboard now fetches **real-time tracking data** from ShipStation's ShipEngine API.

## How It Works

1. **Hourly Cron:** Every hour, Vercel calls `/api/cron/update-tracking`
2. **Fetch Active Shipments:** Gets all non-delivered shipments from the database
3. **Query ShipStation:** Calls ShipEngine API for each tracking number
4. **Update Status:** Updates shipment status, delivery dates, and tracking events
5. **Log Changes:** Tracks status changes (pending → in_transit → delivered)

## ShipStation API Details

**API Endpoint:** `https://api.shipengine.com/v1/tracking`

**Authentication:** API Key in header
```
API-Key: YOUR_API_KEY
```

**Supported Carriers:** 50+ carriers including:
- USPS (via Stamps.com)
- FedEx
- UPS
- DHL Express
- Australia Post
- Canada Post
- And many more

**Status Codes:**
- `AC` - Accepted → maps to `pending`
- `NY` - Not Yet In System → maps to `pending`
- `IT` - In Transit → maps to `in_transit`
- `AT` - Delivery Attempt → maps to `in_transit`
- `DE` - Delivered → maps to `delivered`
- `SP` - Delivered to Service Point → maps to `delivered`
- `EX` - Exception → maps to `exception`
- `UN` - Unknown → maps to `exception`

## Environment Variables

**Local (.env):**
```env
SHIPSTATION_API_KEY=your_api_key_here
CRON_SECRET=your_cron_secret_here
```

**Vercel Dashboard:**
Both environment variables must be set in:
- Settings → Environment Variables
- Add to: Production, Preview, Development

## Files

### New Files
- `lib/shipstation-client.ts` - ShipStation API client
  - `getTrackingInfo()` - Fetch tracking for one shipment
  - `getTrackingInfoBatch()` - Fetch multiple in parallel (future use)
  - `mapShipStationStatus()` - Convert API status to internal status
  - `normalizeCarrierCode()` - Map carrier names to ShipEngine codes

### Updated Files
- `app/api/cron/update-tracking/route.ts` - Now calls ShipStation API
- `app/api/manual-update-tracking/route.ts` - Manual trigger
- `components/ManualTrackingUpdate.tsx` - UI button

## Testing

### Test Manually (via UI)
1. Open dashboard
2. Click "Update All Tracking Now" button
3. Watch for success/error alert

### Test via API
```bash
# Manual trigger
curl https://your-app.vercel.app/api/manual-update-tracking -X POST

# Direct cron call (requires auth)
curl https://your-app.vercel.app/api/cron/update-tracking \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Logs
1. Go to Vercel Dashboard
2. Select tracking-dashboard project
3. Deployments → Latest → Functions
4. Click `/api/cron/update-tracking`
5. View execution logs

Look for:
- `=== Tracking Update Cron Started ===`
- `Found X active shipments to check`
- `Status changed: [tracking#] pending → in_transit`
- `=== Tracking Update Complete ===`

## Error Handling

**If a tracking lookup fails:**
- Error is logged but doesn't stop the batch
- `lastChecked` is still updated to avoid retry loops
- Error message returned in summary

**Common errors:**
- `ShipStation API error (404)` - Tracking number not found
- `ShipStation API error (401)` - Invalid API key
- `Carrier not supported` - Carrier not connected to ShipStation

## Rate Limits

ShipStation doesn't publish specific rate limits for tracking, but:
- Cron runs every hour (max 24 times/day)
- Batch size limited to 50 shipments per run
- Max ~1,200 tracking lookups per day at current settings

To increase throughput:
- Increase `take` limit in cron (up to 100)
- Add parallel processing with `getTrackingInfoBatch()`

## Cost

**ShipStation Advanced Plan:** $99+/month (includes tracking API)

No per-request fees for tracking lookups.

## Next Steps

### Optional Enhancements
1. **Store tracking events** - Save full event history to database
2. **Webhook integration** - Let ShipStation push updates instead of polling
3. **Retry logic** - Exponential backoff for failed lookups
4. **Parallel processing** - Use `getTrackingInfoBatch()` for faster updates
5. **Smart polling** - Check recently shipped items more frequently

### Webhook Alternative
Instead of polling every hour, you can configure ShipStation webhooks:
```
Event: track
URL: https://your-app.vercel.app/api/webhooks/shipstation
```

This would push updates in real-time as carriers report them.
