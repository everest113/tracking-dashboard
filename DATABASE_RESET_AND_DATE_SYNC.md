# Database Reset & Date-Based Sync

## Changes Made

### 1. Database Reset Script

Created `reset-database.sql` to clear all data:

```sql
TRUNCATE TABLE shipments CASCADE;
TRUNCATE TABLE scanned_conversations CASCADE;
TRUNCATE TABLE sync_history CASCADE;
```

**To reset the database:**
```bash
# Option 1: Using psql
psql $DATABASE_URL -f reset-database.sql

# Option 2: Using Prisma Studio
npx prisma studio
# Then manually delete records

# Option 3: Using SQL directly
psql $DATABASE_URL -c "TRUNCATE TABLE shipments, scanned_conversations, sync_history CASCADE;"
```

### 2. Date-Based Sync (Instead of Conversation Limit)

**Before:** Select number of conversations (1-1000)
```
Number of conversations: [100]
```

**After:** Select date to sync from
```
Sync conversations from: [2025-01-09]  (date picker)
```

## How Date-Based Sync Works

### User Interface
- **Date picker** instead of number input
- Default: 30 days ago
- Max: Today (can't select future dates)
- Format: YYYY-MM-DD

### API Changes

**Request:**
```json
POST /api/front/scan
{
  "after": "2025-01-09"  // Date string
}
```

**Backend:**
```typescript
// Convert to Date object
const afterDate = new Date("2025-01-09")

// Fetch conversations created on or after this date
const conversations = await frontClient.getInboxConversations(inboxId, {
  limit: 1000,  // Max to fetch
  after: afterDate
})
```

### Front API Integration

The Front client now supports date filtering:
```typescript
async getInboxConversations(
  inboxId: string,
  options: {
    limit?: number
    after?: Date  // Get conversations created after this date
  }
)
```

**How it works:**
1. Converts date to Unix timestamp
2. Adds `after=<timestamp>` query parameter to Front API
3. Filters results by `created_at` timestamp
4. Returns all matching conversations (up to limit)

## Examples

### Scenario 1: Sync Last 7 Days
```
Date picker: 2025-02-01  (7 days ago)
Result: All conversations from Feb 1 onwards
```

### Scenario 2: Sync Last Month
```
Date picker: 2025-01-08  (30 days ago)
Result: All conversations from Jan 8 onwards
```

### Scenario 3: Sync Specific Date Range
```
Date picker: 2024-12-01
Result: All conversations from Dec 1 onwards
```

## Benefits

### Before (Conversation Count)
- ❌ No control over date range
- ❌ Can't target specific time period
- ❌ Hard to estimate how many conversations cover a period
- ❌ May miss or duplicate conversations

### After (Date Range)
- ✅ Clear control: "sync everything since X date"
- ✅ Predictable results
- ✅ Easy to re-sync a specific time period
- ✅ Better for regular syncs (e.g., "sync last 7 days")

## Use Cases

### Initial Sync
```
Select: 30 days ago (or longer)
Purpose: Get all recent shipments
```

### Daily Sync
```
Select: Yesterday
Purpose: Get new shipments from yesterday
```

### Weekly Sync
```
Select: 7 days ago
Purpose: Catch up on last week
```

### Re-sync Period
```
Select: Specific date when issue occurred
Purpose: Re-process conversations from that date
```

## Database Reset

### When to Reset
- ✅ During development/testing
- ✅ When starting fresh
- ✅ After major changes to extraction logic
- ⚠️ **NEVER in production** without backup!

### What Gets Deleted
- All shipments
- All tracking events (via CASCADE)
- All scanned conversation records
- All sync history

### What Gets Kept
- Database schema
- Indexes
- Table structure

### Safe Reset Process
1. **Backup first** (if in production):
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Run reset script:**
   ```bash
   psql $DATABASE_URL -f reset-database.sql
   ```

3. **Verify:**
   ```bash
   psql $DATABASE_URL -c "
     SELECT 'shipments' as table, COUNT(*) FROM shipments
     UNION ALL
     SELECT 'scanned_conversations', COUNT(*) FROM scanned_conversations;
   "
   ```
   Should show 0 rows for all tables.

4. **Run initial sync:**
   - Open app
   - Click "Sync Front Inbox"
   - Select date (e.g., 30 days ago)
   - Start sync

## API Compatibility

The API still supports the old `limit` parameter for backward compatibility:

```json
// Old way (still works)
{ "limit": 100 }

// New way (recommended)
{ "after": "2025-01-09" }

// Both
{ "after": "2025-01-09", "limit": 1000 }
```

## Front API Date Filtering

**How Front filters by date:**
```
GET /inboxes/{inbox_id}/conversations?after=<unix_timestamp>&limit=100
```

**Example:**
```
Date: 2025-01-09
Unix timestamp: 1736380800
Query: ?after=1736380800&limit=1000
Result: All conversations created on/after Jan 9, 2025
```

## Files Modified

### New Files
- `reset-database.sql` - Database reset script

### Updated Files
- `lib/front-client.ts` - Added date filtering support
- `components/SyncDialog.tsx` - Date picker instead of number input
- `app/api/front/scan/route.ts` - Accept `after` parameter

### Migration
**No database migration needed** - This is UI/API only.

## Testing

### Test 1: Reset Database
```sql
-- Run reset script
psql $DATABASE_URL -f reset-database.sql

-- Verify empty
SELECT COUNT(*) FROM shipments;  -- Should be 0
```

### Test 2: Date-Based Sync
```
1. Open sync dialog
2. Select date: 30 days ago
3. Start sync
4. Verify conversations match date range
```

### Test 3: Already Scanned
```
1. Run sync with date X
2. Run same sync again
3. Should show "all already scanned"
```

## Summary

**Database Reset:**
- ✅ Simple SQL script to clear all data
- ⚠️ Use with caution (destructive!)
- 📝 Always backup first in production

**Date-Based Sync:**
- ✅ Date picker instead of conversation count
- ✅ More intuitive and predictable
- ✅ Better for recurring syncs
- ✅ Front API filtering by timestamp
- ✅ Default: 30 days ago

**Ready to use!** 🚀
