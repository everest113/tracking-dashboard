# Ship24 Integration

## Summary

Migrated tracking updates from ShipStation/ShipEngine to **Ship24** for multi-carrier tracking support.

## Changes Made

### 1. New Ship24 Client (`lib/ship24-client.ts`)
- Created Ship24 API client that matches the ShipStation interface
- Supports all major carriers: USPS, FedEx, UPS, DHL, Canada Post, Australia Post
- Auto-registers trackers on first lookup
- Transforms Ship24 responses to match our existing `TrackingInfo` format
- Includes batch tracking support

### 2. Updated Cron Route (`app/api/cron/update-tracking/route.ts`)
- Replaced ShipStation imports with Ship24
- Changed `getTrackingInfo` calls to use Ship24 API
- Updated status mapping to use `mapShip24Status`
- All other logic remains identical (Prisma updates, error handling, etc.)

### 3. Environment Configuration
- Added `SHIP24_API_KEY` to `.env`, `.env.local`, and `.env.development.local`
- **API Key:** `apik_QN3nLVZ5lV0tbmUhDjXqX5dxNiduwM`
- Also stored in: `~/.config/ship24/api_key`

### 4. Files Changed
```
lib/ship24-client.ts                     [NEW]
app/api/cron/update-tracking/route.ts    [MODIFIED]
.env                                      [MODIFIED]
.env.local                                [MODIFIED]
.env.development.local                    [MODIFIED]
```

## Ship24 API Details

- **Base URL:** `https://api.ship24.com/public/v1`
- **Authentication:** Bearer token in `Authorization` header
- **Main Endpoint:** `POST /trackers/track`
  - Auto-registers tracker if not exists
  - Returns tracking events, status, dates, and location data

### Status Mapping

Ship24 → Internal Status:
- `info_received` → `pending`
- `in_transit` → `in_transit`
- `out_for_delivery` → `in_transit`
- `available_for_pickup` → `in_transit`
- `delivered` → `delivered`
- `delivery_delayed` → `exception`
- `delivery_failed` → `exception`
- `exception` → `exception`
- `expired` → `exception`

### Carrier Codes

Ship24 uses lowercase carrier codes:
- `usps`, `fedex`, `ups`, `dhl`, `canadapost`, `australiapost`

## Testing

To test the integration:

```bash
# Manual trigger via UI (if you have button)
# Or via API:
curl -X POST http://localhost:3002/api/manual-update-tracking \
  -H "Content-Type: application/json"

# Or directly hit the cron endpoint:
curl http://localhost:3002/api/cron/update-tracking \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Next Steps

1. **Deploy to Vercel** - The `.env` changes need to be added to Vercel environment variables:
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add `SHIP24_API_KEY=apik_QN3nLVZ5lV0tbmUhDjXqX5dxNiduwM`

2. **Test with real tracking numbers** - Verify Ship24 returns correct data

3. **Monitor API usage** - Ship24 has rate limits depending on plan

4. **Remove old ShipStation code** (optional):
   - Keep `lib/shipstation-client.ts` for now as reference
   - Can be deleted once Ship24 is fully validated

## Benefits of Ship24

✅ **Multi-carrier support** - Handles 1,100+ carriers automatically  
✅ **Auto-detection** - Can identify carrier from tracking number  
✅ **Unified API** - One endpoint for all carriers  
✅ **Better coverage** - Especially for international shipments  
✅ **Event history** - Full tracking timeline with location data  

## Rollback Plan

If you need to rollback to ShipStation:

1. Revert `app/api/cron/update-tracking/route.ts` to use:
   ```ts
   import { getTrackingInfo, mapShipStationStatus } from '@/lib/shipstation-client'
   ```
2. Change status mapping back to `mapShipStationStatus`

The old ShipStation client file is still present at `lib/shipstation-client.ts`.
