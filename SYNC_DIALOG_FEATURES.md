# Sync Dialog & History Features

## Overview

Added comprehensive sync tracking with:
- ✅ **Interactive sync dialog** with progress tracking
- ✅ **Last sync date display** on homepage
- ✅ **Sync history** stored in database
- ✅ **Sync history viewer** with popover

## Features

### 1. Sync Dialog Component

**Location:** `components/SyncDialog.tsx`

A full-featured dialog that replaces the simple "Scan Front Inbox" button:

**Features:**
- Configure `limit` (1-1000 conversations)
- Configure `batchSize` (1-50 parallel workers)
- Real-time progress display
- Detailed results summary
- Error reporting
- Duration tracking

**States:**
1. **Idle:** Configure sync parameters
2. **Running:** Loading indicator with status message
3. **Success:** Shows detailed summary with metrics
4. **Error:** Displays error information

**Results Display:**
- Conversations scanned
- New shipments found
- Already scanned conversations (AI credits saved!)
- Duplicate shipments skipped
- Conversations with no tracking info
- Sync duration

### 2. Last Sync Display

**Location:** `components/LastSyncDisplay.tsx`

Shows sync information in the page header:

**Features:**
- Last sync timestamp (e.g., "2 minutes ago")
- Sync history popover (click to view)
- Real-time updates
- Status indicators (success/partial/failed)

**Sync History Popover:**
- Last 10 syncs
- Status with color coding
- Conversation count & new shipments
- Duration for each sync
- Relative timestamps

### 3. Sync History Table

**Location:** `prisma/schema.prisma` → `SyncHistory` model

Stores complete sync metadata:

```prisma
model SyncHistory {
  id                          Int      @id
  conversationsProcessed      Int
  conversationsAlreadyScanned Int
  shipmentsAdded              Int
  shipmentsSkipped            Int
  conversationsWithNoTracking Int
  batchSize                   Int
  limit                       Int
  durationMs                  Int?
  errors                      String[]
  status                      String   // success | partial | failed | running
  startedAt                   DateTime
  completedAt                 DateTime?
}
```

### 4. Sync History API

**Location:** `app/api/sync-history/route.ts`

**Endpoint:** `GET /api/sync-history?limit=10`

**Response:**
```json
{
  "success": true,
  "lastSync": {
    "id": 42,
    "conversationsProcessed": 100,
    "shipmentsAdded": 8,
    "status": "success",
    "startedAt": "2024-02-08T21:30:00Z",
    "completedAt": "2024-02-08T21:32:15Z",
    "durationMs": 135000
  },
  "history": [...]
}
```

### 5. Updated Scan API

**Location:** `app/api/front/scan/route.ts`

Now automatically logs every sync attempt:

**Logging:**
- Creates `SyncHistory` record when sync starts (status: "running")
- Updates with results when complete (status: "success"/"partial"/"failed")
- Tracks duration in milliseconds
- Stores all errors encountered

**Status Values:**
- `running` - Sync in progress
- `success` - Completed without errors
- `partial` - Completed with some errors
- `failed` - Fatal error, did not complete

## User Experience

### Starting a Sync

1. Click **"Sync Front Inbox"** button
2. Configure parameters (optional):
   - **Conversations to scan:** Default 100
   - **Parallel processing:** Default 10
3. Click **"Start Sync"**
4. Watch progress indicator
5. View detailed results

### Viewing Last Sync

The header displays:
```
🕐 Last synced 5 minutes ago
```

Click **"Sync History"** to see:
- Recent sync attempts
- Success/failure status
- Metrics for each sync

### Example Sync Results

```
✅ Sync Complete (15.3s)

Conversations Scanned: 100
New Shipments: 12

Already Scanned: 75
Duplicates Skipped: 3
No Tracking Info: 10
Duration: 15.3s
```

## Database Schema Changes

### New Table: `sync_history`

```sql
CREATE TABLE sync_history (
  id SERIAL PRIMARY KEY,
  conversations_processed INTEGER DEFAULT 0,
  conversations_already_scanned INTEGER DEFAULT 0,
  shipments_added INTEGER DEFAULT 0,
  shipments_skipped INTEGER DEFAULT 0,
  conversations_with_no_tracking INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 10,
  limit INTEGER DEFAULT 100,
  duration_ms INTEGER,
  errors TEXT[],
  status VARCHAR(50) DEFAULT 'success',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_started_at ON sync_history(started_at);
```

## Updated Components

### Updated: `app/page.tsx`
- Added `LastSyncDisplay` to header

### Updated: `components/ShipmentTable.tsx`
- Replaced `ScanFrontButton` with `SyncDialog`
- Added supplier column to table
- Updated search to include supplier

### New: `components/SyncDialog.tsx`
- Full-featured sync interface

### New: `components/LastSyncDisplay.tsx`
- Last sync timestamp + history popover

### Removed: `components/ScanFrontButton.tsx`
- Replaced by more comprehensive `SyncDialog`

## Dependencies Added

```json
{
  "dependencies": {
    "date-fns": "^3.3.1"  // For relative date formatting
  }
}
```

## UI Components Added

```bash
npx shadcn@latest add popover  # For sync history dropdown
```

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/front/scan` | POST | Trigger sync, creates history entry |
| `/api/sync-history` | GET | Fetch last sync + history |
| `/api/shipments` | GET | List all shipments (includes supplier now) |

## Benefits

### For Users
- **Clear feedback** - Know exactly what happened during sync
- **Historical context** - See when last sync occurred
- **Troubleshooting** - View errors and sync patterns
- **Control** - Configure sync parameters

### For Developers
- **Audit trail** - Complete history of all sync operations
- **Performance tracking** - Duration metrics for optimization
- **Error monitoring** - All errors logged with context
- **Usage analytics** - Track sync frequency and patterns

## Future Enhancements

- [ ] Auto-sync on a schedule (cron job)
- [ ] Webhook listener for real-time Front updates
- [ ] Email notifications for failed syncs
- [ ] Sync analytics dashboard
- [ ] Export sync history to CSV
- [ ] Retry failed syncs automatically

## Testing Checklist

- [x] Sync dialog opens and closes
- [x] Parameters can be configured
- [x] Progress indicator shows during sync
- [x] Results display correctly
- [x] Errors are shown if they occur
- [x] Last sync date updates after sync
- [x] Sync history popover shows recent syncs
- [x] History is persisted to database
- [x] All sync metadata is logged
- [x] Supplier column appears in shipments table

## Migration Status

✅ Database schema updated  
✅ Prisma client regenerated  
✅ All components created  
✅ Build verified (no errors)  
✅ Dependencies installed  

Ready to deploy! 🚀
