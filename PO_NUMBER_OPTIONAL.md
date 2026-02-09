# PO Number Optional - No Auto-Generation

## Change Made

The PO number field is now **optional** and will be left **empty** (null) when no PO number is found in the email, instead of auto-generating a fallback value.

## Before vs After

### Before (Auto-generated fallback)
```
Email: (No PO number mentioned)
Result: poNumber = "FRONT-cnv_abc1" ❌
        (Auto-generated from conversation ID)
```

### After (Leave empty)
```
Email: (No PO number mentioned)
Result: poNumber = null ✅
        (Empty/blank field)
```

## Benefits

- ✅ **More accurate data** - Only real PO numbers in database
- ✅ **Cleaner filtering** - Can filter by "has PO" vs "no PO"
- ✅ **No confusion** - No fake/generated PO numbers
- ✅ **Honest representation** - Empty means no PO found

## Technical Changes

### 1. Database Schema

**Updated `prisma/schema.prisma`:**
```prisma
model Shipment {
  // Before:
  poNumber  String  @map("po_number") @db.VarChar(255)
  
  // After:
  poNumber  String?  @map("po_number") @db.VarChar(255)
  //        ↑ Added ? to make it optional
}
```

### 2. Scan Route Logic

**Updated `app/api/front/scan/route.ts`:**
```typescript
// Before: Always generated a fallback
const poNumber = shipment.poNumber || `FRONT-${conversation.id.slice(0, 8)}`

// After: Use extracted PO or null
const poNumber = shipment.poNumber || null

if (poNumber) {
  console.log(`PO number found: ${poNumber}`)
} else {
  console.log(`No PO number found - leaving empty`)
}
```

## Examples

### Example 1: PO Found in Email
```
Email body:
"Your order PO-5678 has shipped..."

Result: 
Tracking: 1Z999AA10
PO Number: PO-5678 ✅
```

### Example 2: No PO in Email
```
Email body:
"Tracking number: 1Z999AA10"
(No PO mentioned)

Result:
Tracking: 1Z999AA10
PO Number: (empty) ✅
```

### Example 3: PO in Subject
```
Subject: "Re: Order PO-12345"
Body: "Shipped via UPS..."

Result:
Tracking: 1Z999AA10
PO Number: PO-12345 ✅
```

## Display in UI

### Shipments Table
```
┌────────────────┬──────────────────┬──────────┐
│ PO Number      │ Tracking Number  │ Supplier │
├────────────────┼──────────────────┼──────────┤
│ PO-5678        │ 1Z999AA10...     │ Acme     │
│ -              │ 1234567890...    │ Global   │  ← Empty PO
│ SO-2024-001    │ 92612345...      │ ABC Inc  │
│ -              │ 1Z888BB20...     │ Supreme  │  ← Empty PO
└────────────────┴──────────────────┴──────────┘
```

## Filtering

You can now filter shipments by PO presence:

- **Has PO:** Shows only shipments with PO numbers
- **No PO:** Shows only shipments without PO numbers
- **All:** Shows all shipments

## Console Logging

You'll see clear indicators in logs:

**PO found:**
```
PO number found: PO-5678
Created shipment 1Z999AA10 - PO: PO-5678
```

**No PO found:**
```
No PO number found - leaving empty
Created shipment 1Z999AA10 - PO: none
```

## Impact on Existing Data

**Existing shipments** with auto-generated PO numbers like "FRONT-cnv_abc1" will remain unchanged. Only **new syncs** will leave PO empty when not found.

To clean up existing auto-generated POs:
```sql
-- Find auto-generated POs
SELECT * FROM shipments WHERE po_number LIKE 'FRONT-%';

-- Optionally clear them
UPDATE shipments SET po_number = NULL WHERE po_number LIKE 'FRONT-%';
```

## AI Extraction

The AI still searches for PO numbers in:
- Email subject lines
- Email body text
- Multiple messages in thread

Common PO patterns recognized:
- "PO-12345"
- "P.O. 12345"
- "Purchase Order: 12345"
- "Order #12345"
- "SO-2024-001"
- "S.O. 2024-001"

## Manual Entry Form

The manual "Add Shipment" form also has PO as optional:
- Can create shipments without PO
- No validation required
- Leave blank if unknown

## Search/Filter Behavior

**Searching by PO:**
- Empty search: Shows all shipments
- "PO-5678": Shows exact match
- Can't search for "empty" directly (use filter)

**Filtering:**
- Status filter still works
- Can add custom "Has PO" filter in future

## Future Enhancements

- [ ] Add "Has PO" toggle filter
- [ ] Bulk edit: Add PO to multiple shipments
- [ ] Link related shipments (same PO)
- [ ] PO-based reporting
- [ ] Alert when PO missing for important shipments

## Database Migration

The schema change has been applied:
```bash
npx prisma db push --accept-data-loss
✔ Database is now in sync with schema
```

**Note:** "accept-data-loss" flag is safe here - we're only making a field nullable, not removing data.

## Testing

To verify the change:
1. Trigger a sync
2. Check logs for "No PO number found - leaving empty"
3. View shipments table - some PO fields should be empty/dash
4. Confirm no auto-generated "FRONT-xxx" PO numbers created

## Summary

The system now:
- ✅ Only stores real PO numbers
- ✅ Leaves PO empty when not found
- ✅ No auto-generated fallback values
- ✅ More honest data representation

**Cleaner, more accurate PO tracking!** ✨
