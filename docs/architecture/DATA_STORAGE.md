# Data Storage Overview

## Extracted vs Stored Data

### ✅ Data Being Extracted AND Stored

| Extracted Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| `trackingNumber` | `tracking_number` | VARCHAR(255) | ✓ Unique, required |
| `carrier` | `carrier` | VARCHAR(100) | ✓ ups, usps, fedex, dhl, other |
| `poNumber` | `po_number` | VARCHAR(255) | ✓ Empty string → null |
| `supplier` | `supplier` | VARCHAR(255) | ✓ Empty string → null |
| `shippedDate` | `shipped_date` | DateTime | ✓ **NOW FIXED** - Parses ISO date string |

### ❌ Data Being Extracted But NOT Stored

| Extracted Field | Reason |
|----------------|---------|
| `confidence` | No database column (0-1 score, metadata only) |

### 📊 Additional Database Fields (Not From Extraction)

| Database Column | Source | Notes |
|----------------|--------|-------|
| `status` | Hardcoded | Always "pending" initially |
| `front_conversation_id` | Front API | Links to email conversation |
| `ship24_tracker_id` | Ship24 API | After registering tracker |
| `origin` | Ship24 API | Filled by tracking updates |
| `destination` | Ship24 API | Filled by tracking updates |
| `estimated_delivery` | Ship24 API | Filled by tracking updates |
| `delivered_date` | Ship24 API | Filled when delivered |
| `last_checked` | Ship24 API | Last tracking update timestamp |

## Data Flow

```
Front Email 
  → AI Extraction (OpenAI GPT-4o-mini)
    → {trackingNumber, carrier, poNumber, supplier, shippedDate, confidence}
      → Database Save
        → {tracking_number, carrier, po_number, supplier, shipped_date, status='pending'}
          → Ship24 Registration
            → Tracking Updates fill: {origin, destination, estimated_delivery, etc}
```

## Recent Fix

**Problem:** Shipped dates were being extracted but not saved to database.

**Solution:** Added `shipped_date` parsing in scan route (line 118):
```typescript
shipped_date: shipment.shippedDate ? new Date(shipment.shippedDate) : null
```

Also fixed empty string handling:
```typescript
po_number: shipment.poNumber || null      // "" → null
supplier: extractionResult.supplier || null  // "" → null
```

## Sample Data

```json
{
  "tracking_number": "1ZW9843X0354276615",
  "carrier": "ups",
  "po_number": "102-01",
  "supplier": "Spector & Co.",
  "shipped_date": "2026-01-15T00:00:00Z",
  "status": "pending",
  "front_conversation_id": "cnv_1jva32qv"
}
```
