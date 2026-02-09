# Shipped Date Enhancement

## Overview

The system now intelligently extracts the **shipped date** from email content, with a smart fallback to the **email sent date** when no explicit shipping date is mentioned.

## Priority Logic

1. **AI extracts date from email content** (highest priority)
   - Looks for: "shipped on", "dispatched on", "sent on", "ship date", etc.
   - Parses various date formats
   - Returns ISO date string

2. **Falls back to email sent date** (if not found in content)
   - Uses the timestamp when the email was sent
   - Reasonable assumption: email sent ≈ when shipment occurred

## Examples

### Example 1: Explicit Shipped Date in Email
```
From: orders@acme.com
Date: 2024-02-10 10:30 AM

Your order has shipped!

Order: PO-5678
Tracking: 1Z999AA10123456789
Shipped Date: February 8, 2024  ← AI extracts this

Result: shippedDate = 2024-02-08
```

### Example 2: No Explicit Date (Uses Email Sent Date)
```
From: orders@acme.com
Date: 2024-02-09 2:15 PM  ← Falls back to this

Your tracking number: 1Z999AA10123456789
(No shipped date mentioned)

Result: shippedDate = 2024-02-09
```

### Example 3: Date in Different Format
```
From: shipping@supplier.com
Date: 2024-02-10

Shipment notification

Package shipped: Jan 15, 2024  ← AI parses this
Tracking: 1234567890

Result: shippedDate = 2024-01-15
```

## Technical Implementation

### 1. Updated `lib/tracking-extractor.ts`

**Added sentDate to message type:**
```typescript
messages: Array<{
  subject: string
  body: string
  senderEmail?: string
  senderName?: string
  sentDate?: Date  // ← New field for fallback
}>
```

**Enhanced AI prompt:**
```
4. **Extract SHIPPED DATE from email content:**
   - Look for "shipped on", "shipped date", "dispatch date", "sent on", etc.
   - Parse dates in any format (MM/DD/YYYY, YYYY-MM-DD, "January 15, 2024", etc.)
   - Return as ISO date string (YYYY-MM-DD)
   - If no shipped date found in content, the system will use the email sent date as fallback
```

### 2. Updated `app/api/front/scan/route.ts`

**Pass email sent date to extractor:**
```typescript
const messagesToExtract = messages.map(msg => ({
  subject: msg.subject || conversation.subject,
  body: msg.text || msg.body,
  senderEmail: msg.author?.email,
  senderName: msg.author?.name,
  sentDate: msg.created_at ? new Date(msg.created_at * 1000) : undefined,
}))
```

**Use fallback logic:**
```typescript
// Get email sent date for fallback (use first message in thread)
const emailSentDate = messages[0]?.created_at 
  ? new Date(messages[0].created_at * 1000) 
  : null

// Use shipped date from AI extraction, or fall back to email sent date
let shippedDate: Date | null = null
if (shipment.shippedDate) {
  shippedDate = new Date(shipment.shippedDate)
} else if (emailSentDate) {
  shippedDate = emailSentDate
  console.log(`Using email sent date as shipped date: ${emailSentDate.toISOString()}`)
}
```

## Date Format Handling

The AI can parse various date formats:

| Format | Example | Parsed To |
|--------|---------|-----------|
| ISO | 2024-02-08 | 2024-02-08 |
| US | 02/08/2024 | 2024-02-08 |
| EU | 08/02/2024 | 2024-02-08 |
| Long | February 8, 2024 | 2024-02-08 |
| Short | Feb 8, 2024 | 2024-02-08 |
| Timestamp | 2024-02-08T14:30:00Z | 2024-02-08 |

## Benefits

### Before
```
Shipped Date: null  ❌
(No date information)
```

### After
```
Shipped Date: 2024-02-08  ✅
(From email content or sent date)
```

**Now you can:**
- Sort shipments by ship date
- Filter by date range
- Calculate delivery times
- Track shipping patterns

## Fallback Priority

```
1. AI-extracted date from email content
   ↓ (if not found)
2. Email sent date (message timestamp)
   ↓ (if not available)
3. null (no date information)
```

## Example AI Extraction Phrases

The AI looks for these types of phrases:

- "Shipped on February 8"
- "Ship date: 2/8/2024"
- "Dispatched: 02-08-2024"
- "Sent out on Feb 8th"
- "Package shipped 2/8"
- "Departure date: 2024-02-08"
- "Shipped Date: 02/08/24"

## Console Logging

You'll see logs indicating the source:

**AI extracted date:**
```
Created shipment 1Z999AA10 - Shipped: 2024-02-08T00:00:00.000Z
```

**Fallback to email date:**
```
Using email sent date as shipped date: 2024-02-09T14:15:00.000Z
Created shipment 1Z999AA10 - Shipped: 2024-02-09T14:15:00.000Z
```

## Impact on Existing Data

**Note:** This only affects **new syncs**. Existing shipments keep their current shipped dates.

To update existing shipments:
1. Clear `scanned_conversations` table (force rescan)
2. Run sync with `force: true` flag
3. Or manually update shipped dates in database

## Edge Cases

### Multiple Dates in Email
If multiple dates are mentioned, AI prioritizes:
1. Date explicitly labeled as "ship date" or "shipped on"
2. Date closest to tracking number mention
3. Most recent date if ambiguous

### Relative Dates
```
"Shipped yesterday" → AI may not parse correctly
→ Falls back to email sent date (reasonable approximation)
```

### Time Zones
- Email sent dates use the sender's timezone
- Dates are stored in database as UTC
- Display formatting can adjust for user timezone

## Usage

### Automatic (Default)
Just run a sync - shipped dates are automatically extracted:
```bash
POST /api/front/scan
```

### View Results
Check shipments table - shipped date column now populated:
```
Tracking: 1Z999AA10
Shipped: 2024-02-08
(Extracted from email)
```

## Testing

To verify shipped date extraction:
1. Trigger a sync
2. Check console logs for:
   - AI-extracted dates
   - Fallback messages
3. View shipments table - shipped date should be populated
4. Sort by shipped date to verify accuracy

## Future Enhancements

- [ ] Parse relative dates ("shipped yesterday", "sent today")
- [ ] Timezone adjustment based on supplier location
- [ ] Estimated delivery date calculation
- [ ] Shipping delay alerts
- [ ] Date validation (flag suspicious dates)

## Summary

The system now:
- ✅ Extracts shipped date from email content (AI)
- ✅ Falls back to email sent date (smart default)
- ✅ Handles multiple date formats
- ✅ Provides date for every shipment

**Much better date tracking!** 📅
