# Parallel Processing Analysis

## Current Implementation

### ✅ What We DO Have (Parallel Processing)

**Within Each Batch:**
```typescript
await Promise.allSettled(
  conversations.map(async (conversation) => {
    // Each conversation processes in parallel
    const messages = await frontClient.getConversationMessages(conversation.id)
    const extractionResult = await extractTrackingFromEmail(messagesToExtract)
    // Save to database
  })
)
```

**Current Flow:**
```
Batch 1 (10 conversations) → Process all 10 in parallel → Wait
  ↓ 1 second delay
Batch 2 (10 conversations) → Process all 10 in parallel → Wait
  ↓ 1 second delay
Batch 3 (10 conversations) → Process all 10 in parallel → Wait
```

### ❌ What We DON'T Have (Sequential Between Batches)

**Between Batches:**
```typescript
for (let i = 0; i < unscannedConversations.length; i += batchSize) {
  const batch = unscannedConversations.slice(i, i + batchSize)
  await processBatch(batch)  // ← Waits for entire batch to complete
  
  if (i + batchSize < unscannedConversations.length) {
    await new Promise(resolve => setTimeout(resolve, 1000))  // ← 1 second delay
  }
}
```

**Issue:** Batches process sequentially, not in parallel.

## Performance Numbers

### Current Performance
- **Batch size**: 10 conversations
- **Parallel per batch**: 10 simultaneous OpenAI calls
- **Delay between batches**: 1 second
- **Total for 100 conversations**: ~10 batches × (~3s per batch + 1s delay) = ~40 seconds

### With Improvements
- **Larger batches**: 20 conversations
- **No delay** (rate limit handled by semaphore)
- **Total for 100 conversations**: ~5 batches × ~3s = ~15 seconds

## Improvement Options

### Option 1: Increase Batch Size (Simple) ✅ RECOMMENDED

**Change:**
```typescript
const { batchSize = 20, pageSize = 100, maxPages } = body  // 10 → 20
```

**Pros:**
- 1 line change
- 2x throughput improvement
- Still respects OpenAI rate limits

**Cons:**
- More memory usage
- Harder to see progress in logs

**Impact:** 100 conversations in ~20s instead of ~40s

---

### Option 2: Remove/Reduce Delay (Medium) ✅ RECOMMENDED

**Change:**
```typescript
// Remove fixed delay, or make it configurable
const delay = process.env.BATCH_DELAY_MS || 0  // 1000 → 0
if (delay > 0 && i + batchSize < unscannedConversations.length) {
  await new Promise(resolve => setTimeout(resolve, delay))
}
```

**Pros:**
- No artificial slowdown
- Faster processing

**Cons:**
- Risk of rate limiting (OpenAI allows ~500 RPM for GPT-4o-mini)

**Impact:** Save 1s × number of batches

---

### Option 3: Semaphore-Based Concurrency (Advanced) ⚡ BEST

**Implementation:**
```typescript
import pLimit from 'p-limit'

const limit = pLimit(20)  // Max 20 concurrent operations

const promises = unscannedConversations.map(conversation => 
  limit(() => processConversation(conversation))
)

await Promise.allSettled(promises)
```

**Pros:**
- Smooth concurrency control
- No artificial batching
- Better progress visibility
- Handles rate limits gracefully

**Cons:**
- Requires `p-limit` package
- More complex code

**Impact:** Maximum throughput with safety

---

### Option 4: Parallel Batches (Complex) ⚠️ NOT RECOMMENDED

**Implementation:**
```typescript
const batchPromises = []
for (let i = 0; i < unscannedConversations.length; i += batchSize) {
  const batch = unscannedConversations.slice(i, i + batchSize)
  batchPromises.push(processBatch(batch))
}
await Promise.all(batchPromises)
```

**Pros:**
- Maximum parallelism

**Cons:**
- **Risk of rate limiting** (all batches run simultaneously)
- High memory usage
- Database connection pool exhaustion
- Hard to manage errors

**Impact:** NOT RECOMMENDED - likely to hit rate limits

## Rate Limits to Consider

### OpenAI (GPT-4o-mini)
- **RPM**: 500 requests per minute (Tier 1)
- **TPM**: 200,000 tokens per minute
- **Batch**: 200,000 per day

**Safe Concurrency**: ~16-20 conversations/second = 960/minute < 1000 limit ✓

### Front API
- **Rate limit**: Not publicly documented, but conservative
- **Current**: ~10 conversations/second with delays
- **Safe**: 20-30 conversations/second should be fine

### Database (Neon)
- **Connection pool**: Default 10 connections
- **Current usage**: ~10 concurrent writes (safe)
- **Safe**: Up to 50 concurrent with proper pooling

## Recommended Implementation

### Phase 1: Quick Wins (5 minutes)
```typescript
// 1. Increase batch size
const { batchSize = 20 } = body  // 10 → 20

// 2. Remove artificial delay
// Delete or comment out:
// await new Promise(resolve => setTimeout(resolve, 1000))
```

### Phase 2: Semaphore (30 minutes)
```bash
npm install p-limit
```

```typescript
import pLimit from 'p-limit'

async function processAllConversations(conversations: FrontConversation[]) {
  const limit = pLimit(20)  // Max 20 concurrent
  
  const promises = conversations.map(conversation =>
    limit(async () => {
      try {
        return await processConversation(conversation)
      } catch (error) {
        console.error(`Error processing ${conversation.id}:`, error)
        return { error }
      }
    })
  )
  
  return await Promise.allSettled(promises)
}
```

## Testing Parallel Processing

```bash
# Test with 50 conversations
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"after": "2026-02-01", "batchSize": 20}'

# Watch console for timing:
# Processing batch 1 (20 conversations)  # ← Should be faster
# Processing batch 2 (20 conversations)
# Processing batch 3 (10 conversations)
```

## Monitoring

Add timing logs:
```typescript
const batchStart = Date.now()
const batchResults = await processBatch(batch)
console.log(`Batch completed in ${Date.now() - batchStart}ms`)
```

## Summary

| Approach | Effort | Speed Gain | Risk | Recommended |
|----------|--------|------------|------|-------------|
| Increase batch size | 1 min | 2x | Low | ✅ YES |
| Remove delay | 1 min | 1.5x | Low | ✅ YES |
| Semaphore | 30 min | 2-3x | Low | ✅ YES (best) |
| Parallel batches | 1 hour | 5x | High | ❌ NO |

**Best approach:** Semaphore-based concurrency (Option 3)
- Smooth, safe, scalable
- Handles rate limits gracefully
- Better than fixed batching
