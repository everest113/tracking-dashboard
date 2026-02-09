# Conversation Caching - Verification & How It Works

## ✅ Yes, We're Correctly Skipping Already-Scanned Emails!

The system is working correctly to avoid unnecessary AI calls.

## How It Works

### 1. Check Database BEFORE Processing

**Code flow:**
```typescript
// Check if already scanned (unless force flag is set)
if (!force) {
  const alreadyScanned = await prisma.scannedConversation.findUnique({
    where: { conversationId: conversation.id },
  })

  if (alreadyScanned) {
    console.log(`Conversation ${conversation.id} already scanned - skipping`)
    results.alreadyScanned++
    return  // ← EXIT EARLY - No AI call made!
  }
}

// Only reaches here if NOT already scanned
const messages = await frontClient.getFullConversation(conversation.id)
const extraction = await extractTrackingInfo(messagesToExtract)  // AI call
```

### 2. Persist to Database AFTER Processing

**After successful extraction:**
```typescript
// Mark conversation as scanned
await prisma.scannedConversation.upsert({
  where: { conversationId: conversation.id },
  update: { 
    scannedAt: new Date(),
    shipmentsFound: shipmentsAddedThisConvo,
  },
  create: {
    conversationId: conversation.id,
    subject: conversation.subject,
    shipmentsFound: shipmentsAddedThisConvo,
  },
})
```

## Verification Flow

### First Sync (New Conversation)
```
1. Check database: ❌ Not found in scanned_conversations
2. Fetch messages from Front
3. Call OpenAI for extraction  ← AI CALL MADE
4. Create shipments
5. Mark as scanned ✅ → Save to scanned_conversations
```

### Second Sync (Same Conversation)
```
1. Check database: ✅ Found in scanned_conversations
2. Skip! Return early  ← NO AI CALL!
3. (Never reaches message fetch or OpenAI)
```

## Database Table: `scanned_conversations`

Stores which conversations have been processed:

```sql
CREATE TABLE scanned_conversations (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT,
  shipments_found INTEGER DEFAULT 0,
  scanned_at TIMESTAMP DEFAULT NOW()
);
```

## API Call Savings Example

**Scenario: Sync 100 conversations daily**

### Day 1 (First sync)
- Conversations in database: 0
- AI calls made: 100
- Cost: ~$0.10 (100 × $0.001)

### Day 2 (95 already scanned, 5 new)
- Conversations in database: 100
- Already scanned: 95 ✅ (skipped, no AI call)
- New conversations: 5
- AI calls made: 5
- Cost: ~$0.005 (5 × $0.001)
- **Savings: 95% reduction in AI calls!**

### Week total
- Without caching: 700 AI calls ($0.70)
- With caching: ~135 AI calls ($0.135)
- **Savings: $0.565 (81% cost reduction)**

## Console Output Verification

### Already Scanned (Skipped)
```
Processing conversation: cnv_abc123
Conversation cnv_abc123 already scanned - skipping
↑ No AI call made - exited early
```

### New Conversation (Processed)
```
Processing conversation: cnv_xyz789
Found 2 messages in cnv_xyz789
Extracted 1 shipments from cnv_xyz789  ← AI extraction happened
Supplier identified: Acme Manufacturing
Created shipment 1Z999AA10
↑ AI call was made for new conversation
```

## Summary Statistics

When you run a sync, you'll see:
```json
{
  "summary": {
    "conversationsProcessed": 100,
    "conversationsAlreadyScanned": 85,  // ← Skipped (no AI calls)
    "shipmentsAdded": 12,                // ← Only from 15 new convos
    "shipmentsSkipped": 3,
    "conversationsWithNoTracking": 0
  }
}
```

**`conversationsAlreadyScanned`** = Number of AI calls saved!

## Force Rescan Option

To override the cache (re-scan everything):
```bash
POST /api/front/scan
{
  "limit": 100,
  "force": true  // ← Bypasses cache check
}
```

**Use when:**
- Testing AI extraction changes
- Conversation was updated with new messages
- Fixing incorrectly scanned data

## Verify It's Working

### Method 1: Check Database
```sql
-- See all scanned conversations
SELECT conversation_id, subject, shipments_found, scanned_at 
FROM scanned_conversations 
ORDER BY scanned_at DESC;

-- Count how many have been scanned
SELECT COUNT(*) as total_scanned FROM scanned_conversations;
```

### Method 2: Check Console Logs
Run a sync twice and compare logs:

**First run:**
```
Extracted 1 shipments from cnv_abc123  ← AI called
Extracted 2 shipments from cnv_def456  ← AI called
Extracted 0 shipments from cnv_ghi789  ← AI called
```

**Second run (same conversations):**
```
Conversation cnv_abc123 already scanned - skipping  ← No AI call
Conversation cnv_def456 already scanned - skipping  ← No AI call
Conversation cnv_ghi789 already scanned - skipping  ← No AI call
```

### Method 3: Check API Response
```json
{
  "summary": {
    "conversationsProcessed": 50,
    "conversationsAlreadyScanned": 48,  // ← 96% cache hit rate!
    "shipmentsAdded": 2
  }
}
```

## Edge Cases Handled

### Conversation with No Messages
```typescript
if (messages.length === 0) {
  // Still mark as scanned to avoid re-checking
  await prisma.scannedConversation.upsert(...)
  return
}
```

### Extraction Errors
If OpenAI fails, the conversation is **NOT marked as scanned** so it will retry next time.

### Database Constraints
- `conversation_id` is **UNIQUE** - prevents duplicates
- `upsert` handles both create and update safely

## Performance Impact

### Without Caching (Every Sync Calls AI)
```
100 conversations × 2 seconds = 200 seconds
Cost: $0.10
```

### With Caching (Only New Conversations)
```
5 new conversations × 2 seconds = 10 seconds
95 cached (instant) = ~0 seconds
Total: ~10 seconds
Cost: $0.005
```

**Result:**
- ⚡ 20x faster
- 💰 95% cheaper
- 🌍 Less carbon footprint

## Monitoring Cache Effectiveness

Track `conversationsAlreadyScanned` over time:

| Day | Total | Scanned | New | Cache Hit % |
|-----|-------|---------|-----|-------------|
| 1   | 100   | 0       | 100 | 0%          |
| 2   | 100   | 95      | 5   | 95%         |
| 3   | 100   | 98      | 2   | 98%         |
| 7   | 100   | 99      | 1   | 99%         |

After initial sync, you should see **90-99% cache hit rates**.

## Database Maintenance

### Clear Cache (Re-scan Everything)
```sql
-- Option 1: Clear all
TRUNCATE scanned_conversations;

-- Option 2: Clear old entries (older than 30 days)
DELETE FROM scanned_conversations 
WHERE scanned_at < NOW() - INTERVAL '30 days';

-- Option 3: Clear conversations with no shipments found
DELETE FROM scanned_conversations 
WHERE shipments_found = 0;
```

### View Cache Statistics
```sql
SELECT 
  COUNT(*) as total_conversations,
  SUM(shipments_found) as total_shipments,
  AVG(shipments_found) as avg_shipments_per_convo,
  MAX(scanned_at) as last_scan,
  MIN(scanned_at) as first_scan
FROM scanned_conversations;
```

## Summary

✅ **Yes, the system correctly skips already-scanned emails!**

**The flow:**
1. Check `scanned_conversations` table first
2. If found → Skip (no AI call) ✅
3. If not found → Process with AI
4. After processing → Save to database
5. Next sync → Will be skipped

**Benefits:**
- 💰 Saves 90-99% of AI costs after initial sync
- ⚡ 20x faster on subsequent syncs
- 🎯 No duplicate processing
- 📊 Track what's been scanned

**Verification:**
- Check `conversationsAlreadyScanned` in API response
- View console logs for "already scanned - skipping"
- Query `scanned_conversations` table

**The caching is working perfectly!** 🎉
