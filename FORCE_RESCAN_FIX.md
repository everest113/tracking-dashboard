# Force Rescan Fix - Update Existing Shipments

## Problem

When "Force Rescan" was checked in the Sync Front Inbox dialog, it would:
- ✅ Re-analyze already-scanned conversations
- ❌ But still skip existing tracking numbers (showed as "Skipped: 18")

The force rescan should allow updating existing shipments with fresh data from emails.

## Solution

Updated `/app/api/front/scan/route.ts` to handle force rescan properly:

### Changes

1. **Pass `forceRescan` flag to `processBatch()`**
   - Added parameter to process function
   - Used throughout the batch processing

2. **Update existing shipments when force rescan is enabled**
   ```typescript
   if (existing) {
     if (forceRescan) {
       // Force rescan: Update existing shipment with fresh data from email
       const updatedShipment = await prisma.shipments.update({
         where: { tracking_number: shipment.trackingNumber },
         data: {
           carrier: shipment.carrier,
           po_number: shipment.poNumber,
           supplier: extractionResult.supplier,
           shipped_date: shipment.shippedDate ? new Date(shipment.shippedDate) : undefined,
           front_conversation_id: conversation.id,
           updated_at: new Date(),
         },
       })
       
       // Re-register with Ship24 to fetch fresh tracking data
       shipmentsToRegister.push(updatedShipment)
       results.updated++
     } else {
       // Normal mode: Skip existing
       results.skipped++
     }
   }
   ```

3. **Re-register updated shipments with Ship24**
   - Updated shipments are added to `shipmentsToRegister` array
   - Bulk registration fetches fresh tracking data from Ship24
   - Updates status, delivery dates, events, etc.

4. **Track "Updated" count separately**
   - Added `updated` counter to results
   - Displayed in API response and UI
   - Shows in sync summary dialog

## UI Changes

**SyncDialog.tsx**:
- Added `shipmentsUpdated` to summary interface
- Displays "Shipments Updated" stat when > 0
- Toast shows: "Updated X shipments (Y new, Z updated)"
- Progress stream shows: "🔄 Z existing shipments updated!"

## Developer Mode

Force rescan requires `DEV_ALLOW_RESCAN=true` in `.env`:
```bash
# Developer Mode - Allow rescanning already analyzed conversations
DEV_ALLOW_RESCAN=true
```

And `NODE_ENV=development` (automatic in `npm run dev`).

## Use Cases

**When to use force rescan:**

1. **Testing extraction changes** - After updating AI prompts
2. **Fixing bad data** - When tracking numbers were extracted incorrectly
3. **Updating supplier info** - When supplier names/PO numbers changed in emails
4. **Refreshing Ship24 data** - Get latest tracking info for existing shipments

**Warning:**
- Force rescan uses AI credits for already-scanned conversations
- Only enable in development for testing

## Example Output

Before (without force rescan):
```
Processed: 66
Added: 1
Skipped: 18  ← Existing tracking numbers ignored
```

After (with force rescan):
```
Processed: 66
Added: 1
Updated: 18  ← Existing tracking numbers refreshed!
Skipped: 0
```

## Testing

1. Start dev server: `npm run dev`
2. Open Sync Front Inbox dialog
3. Check "Force rescan" checkbox (only visible in dev mode)
4. Click "Start Sync"
5. Verify:
   - "Updated" count shows in results
   - Existing shipments have fresh data
   - Ship24 tracking info is refreshed

## Files Changed

- `/app/api/front/scan/route.ts` - Added force rescan logic
- `/components/SyncDialog.tsx` - Display updated count
- `/FORCE_RESCAN_FIX.md` - This documentation
