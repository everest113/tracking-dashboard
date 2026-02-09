# Ship24 Client Migration Guide

## ❌ Removed Files

- `lib/ship24-client.ts` (old 421-line implementation)
- `lib/front-client.ts` (backward compat re-export)

## ✅ Use Instead

### For Ship24 Operations

```typescript
// OLD
import { registerTracker } from '@/lib/ship24-client'

// NEW
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

const service = getShipmentTrackingService()
await service.registerTracker(trackingNumber, carrier, poNumber)
```

### For Front Operations

```typescript
// OLD
import { frontClient } from '@/lib/front-client'

// NEW
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'

const client = getFrontClient()
await client.listConversations({ limit: 100 })
```

## 🔄 API Routes That Need Updates

The following routes import from the old clients:

1. `app/api/shipments/route.ts` - Uses `registerTracker`
2. `app/api/trackers/backfill/route.ts` - Uses `registerTrackersBulk`
3. `app/api/manual-update-tracking/route.ts` - Uses `getTrackerResults`, `mapShip24Status`
4. `app/api/webhooks/ship24/route.ts` - Uses `mapShip24Status`
5. `app/api/front/scan/route.ts` - Uses `registerTracker`, `frontClient`
6. `app/api/cron/update-tracking/route.ts` - Uses `getTrackingInfo`, `mapShip24Status`

## 📝 Migration Mapping

### Ship24 Functions

| Old Function | New Approach |
|--------------|--------------|
| `registerTracker(tn, carrier, po)` | `service.registerTracker(tn, carrier, po)` |
| `registerTrackersBulk(shipments)` | `service.registerTrackersBulk(shipments)` |
| `getTrackerResults(trackerId)` | `ship24Client.getTrackerResults(trackerId)` |
| `getTrackingInfo(trackingNumber)` | Use Ship24Client directly |
| `mapShip24Status(status)` | `Ship24Mapper` methods |

### Front Functions

| Old Function | New Approach |
|--------------|--------------|
| `frontClient.listConversations()` | `getFrontClient().listConversations()` |
| `frontClient.getFullConversation()` | `getFrontClient().getConversationMessages()` |

## 🎯 Recommended Approach

For Ship24 operations, use **ShipmentTrackingService** (high-level):
```typescript
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
```

For direct Ship24 API access (low-level):
```typescript
import { createShip24Client } from '@/lib/infrastructure/sdks/ship24/client'
```

For Front API access:
```typescript
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'
```
