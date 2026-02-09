# Parallel Scanning & Unlimited Conversations

## Overview

The Front inbox scanner now supports:
- ✅ **Parallel processing** - Process multiple conversations simultaneously
- ✅ **Unlimited conversations** - Scan any number (not limited to 50)
- ✅ **Pagination support** - Automatically fetches all pages from Front API
- ✅ **Batch control** - Configurable concurrency to avoid API rate limits

## How It Works

### 1. Parallel Processing

Previously: **Sequential processing** (one conversation at a time)
```typescript
for (const conversation of conversations) {
  await processConversation(conversation)  // Slow! ⏱️
}
```

Now: **Parallel batch processing**
```typescript
await Promise.allSettled(
  batch.map(conversation => processConversation(conversation))
)
// Process 10 conversations at once! 🚀
```

### 2. Unlimited Conversations with Pagination

Front API has a max of 100 conversations per request. The client now automatically handles pagination:

```typescript
async getInboxConversations(inboxId: string, limit = 100) {
  let pageUrl = `/inboxes/${inboxId}/conversations?limit=100`
  
  while (pageUrl && remaining > 0) {
    const data = await this.fetch(pageUrl)
    conversations.push(...data._results)
    
    // Get next page
    pageUrl = data._pagination?.next
  }
  
  return conversations
}
```

You can now request **any number** of conversations:
- `limit: 100` → 100 conversations (1 API request)
- `limit: 500` → 500 conversations (5 API requests)
- `limit: 1000` → 1,000 conversations (10 API requests)

### 3. Batch Processing

To avoid overwhelming the API and database, conversations are processed in batches:

```typescript
const batchSize = 10  // Process 10 at a time

for (let i = 0; i < conversations.length; i += batchSize) {
  const batch = conversations.slice(i, i + batchSize)
  await processBatch(batch)  // All 10 in parallel
}
```

## API Usage

### Default Scan (100 conversations, batch size 10)
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json"
```

### Scan 500 Conversations
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"limit": 500}'
```

### Custom Batch Size (More Parallel Processing)
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"limit": 200, "batchSize": 20}'
```

### Force Rescan with Higher Limits
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000, "force": true, "batchSize": 15}'
```

## Performance Comparison

### Before (Sequential, limit 50)
- **Processing time:** ~2 seconds per conversation
- **50 conversations:** ~100 seconds (1 min 40 sec)
- **Bottleneck:** Each conversation waits for the previous one

### After (Parallel, unlimited)
- **Processing time:** ~2 seconds per conversation
- **50 conversations (batch size 10):** ~10 seconds (5 batches × 2 sec)
- **500 conversations (batch size 10):** ~100 seconds (50 batches × 2 sec)
- **Speedup:** **10x faster** with batch size 10

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Max conversations to fetch |
| `force` | boolean | false | Re-scan already-processed conversations |
| `batchSize` | number | 10 | Conversations to process in parallel |

### Choosing Batch Size

**Smaller batch size (5-10):**
- ✅ More conservative
- ✅ Better for rate-limited APIs
- ✅ Less memory usage
- ⚠️ Slightly slower for large scans

**Larger batch size (20-50):**
- ✅ Faster for bulk processing
- ⚠️ Higher API load
- ⚠️ More memory usage
- ⚠️ Risk of rate limits

**Recommendation:** Start with `10`, increase to `20` if no issues.

## Response Example

```json
{
  "success": true,
  "summary": {
    "conversationsProcessed": 500,
    "conversationsAlreadyScanned": 350,
    "shipmentsAdded": 85,
    "shipmentsSkipped": 12,
    "conversationsWithNoTracking": 53,
    "batchSize": 10
  }
}
```

## Error Handling

Uses `Promise.allSettled()` instead of `Promise.all()`:
- ✅ One failed conversation doesn't stop the batch
- ✅ Errors are collected and reported
- ✅ Successful conversations are still processed

## Rate Limiting Considerations

Front API rate limits (typical):
- **100 requests/minute** for most endpoints
- **Conversation list:** 1 request per 100 conversations
- **Message fetch:** 1 request per conversation

**Example calculation for 500 conversations:**
- Fetching conversations: ~5 API requests
- Fetching messages: ~150 requests (only unscanned ones)
- **Total:** ~155 requests
- **Time needed:** ~2-3 minutes (to stay under rate limit)

The batch processing helps spread requests over time.

## Best Practices

1. **Initial scan:** Use large limit (500-1000) with default batch size
2. **Regular scans:** Use moderate limit (100-200) since most are already scanned
3. **Monitor errors:** Check the `errors` array in response
4. **Adjust batch size:** Increase if no rate limit issues, decrease if you see 429 errors

## Monitoring

Watch for these in logs:
```
Processing batch 1/50 (10 conversations)
Processing batch 2/50 (10 conversations)
...
=== Scan Complete === {
  conversationsProcessed: 500,
  conversationsAlreadyScanned: 350,
  ...
}
```

## Future Enhancements

- [ ] Auto-adjust batch size based on API response times
- [ ] Exponential backoff for rate limit errors
- [ ] Progress streaming via Server-Sent Events
- [ ] Queue system for background processing
- [ ] Metrics dashboard showing scan performance
