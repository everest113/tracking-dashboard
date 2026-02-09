# Tracking Number Validation Fix

## Error

```
TypeError: Cannot read properties of undefined (reading 'toUpperCase')
at extractTrackingInfo (lib/tracking-extractor.ts:134:10)
```

## Problem

The AI occasionally returned shipment objects **without tracking numbers**, causing the code to crash when trying to call `.toUpperCase()` on `undefined`:

```typescript
// Before: No validation
result.shipments = result.shipments.map(shipment => ({
  ...shipment,
  trackingNumber: shipment.trackingNumber.toUpperCase()  // ← Crashes if undefined!
}))
```

## Solution

Added **validation** to filter out invalid shipments before normalization:

```typescript
// After: Validate first, then normalize
result.shipments = (result.shipments || [])
  .filter(shipment => {
    // Filter out shipments without tracking numbers
    if (!shipment.trackingNumber || typeof shipment.trackingNumber !== 'string') {
      console.warn('Skipping shipment with invalid tracking number:', shipment)
      return false
    }
    return true
  })
  .map(shipment => ({
    ...shipment,
    trackingNumber: shipment.trackingNumber
      .toUpperCase()
      .replace(/[\s-]/g, ''),
  }))
```

## Why This Happened

The AI extraction can return:
- `{ shipments: [] }` - No tracking found
- `{ shipments: [{ trackingNumber: "1Z..." }] }` - Valid
- `{ shipments: [{ carrier: "ups" }] }` - **Invalid** (missing trackingNumber)
- `{ shipments: [{ trackingNumber: null }] }` - **Invalid** (null value)

Without validation, any invalid shipment would crash the code.

## Validation Checks

The filter now checks:
1. **Field exists:** `shipment.trackingNumber` is not undefined
2. **Type is string:** `typeof shipment.trackingNumber === 'string'`
3. **Logs warning:** Shows which shipment was skipped in console

## Example Scenarios

### Scenario 1: Valid Shipment
```json
{
  "shipments": [
    { "trackingNumber": "1Z999AA10", "carrier": "ups" }
  ]
}
```
✅ **Result:** Normalized to "1Z999AA10" (uppercase, no spaces)

### Scenario 2: Invalid Shipment (No Tracking)
```json
{
  "shipments": [
    { "carrier": "ups", "poNumber": "PO-123" }
  ]
}
```
⚠️ **Result:** Filtered out, warning logged
```
Skipping shipment with invalid tracking number: { carrier: "ups", poNumber: "PO-123" }
```

### Scenario 3: Null Tracking Number
```json
{
  "shipments": [
    { "trackingNumber": null, "carrier": "fedex" }
  ]
}
```
⚠️ **Result:** Filtered out, warning logged

### Scenario 4: Mixed Valid/Invalid
```json
{
  "shipments": [
    { "trackingNumber": "1Z999AA10", "carrier": "ups" },
    { "carrier": "fedex" },
    { "trackingNumber": "9261234567", "carrier": "usps" }
  ]
}
```
✅ **Result:** Only valid ones kept (1st and 3rd)

## Enhanced AI Prompt

Also updated the AI prompt to emphasize valid tracking numbers:

```
IMPORTANT: 
- **ONLY include shipments with valid tracking numbers** - do not return empty or null trackingNumber
- **If no valid tracking numbers found, return empty shipments array**
```

## Console Output

When a shipment is filtered out, you'll see:
```
Skipping shipment with invalid tracking number: { carrier: "ups" }
Extracted 0 shipments from cnv_abc123
```

## Testing

To verify the fix works:

### Test 1: Normal Email (Valid Tracking)
```
Email: "Your tracking: 1Z999AA10123456789"
Result: ✅ Shipment created
```

### Test 2: Email with No Tracking
```
Email: "Your order will ship soon"
Result: ✅ No crash, returns empty shipments array
```

### Test 3: Malformed AI Response
```
AI returns: { "shipments": [{ "carrier": "ups" }] }
Result: ✅ Filtered out, logged warning
```

## Error Prevention

The validation prevents crashes from:
- ✅ Missing `trackingNumber` field
- ✅ `null` tracking numbers
- ✅ Empty string tracking numbers
- ✅ Non-string types (numbers, objects, etc.)
- ✅ Missing `shipments` array

## Impact on Existing Data

This is a **code-only fix** - no database changes needed. It just makes the extraction more robust.

## Future Improvements

- [ ] Add tracking number format validation (regex patterns)
- [ ] Retry extraction if no valid tracking found
- [ ] Log AI responses that return invalid data
- [ ] Alert when AI frequently returns invalid shipments

## Summary

**The fix:**
- ✅ Validates tracking numbers before normalization
- ✅ Filters out invalid shipments
- ✅ Logs warnings for debugging
- ✅ Prevents crashes from undefined/null values
- ✅ More robust extraction

**Now the system gracefully handles AI responses that don't include tracking numbers!** 🛡️
