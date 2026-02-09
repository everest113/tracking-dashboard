# AI Credit Optimization - Conversation Tracking

## Problem
Previously, every time we scanned the Front inbox, we would call OpenAI on **every conversation** - even ones we'd already processed. This wasted AI credits and processing time.

## Solution
Added a **conversation tracking system** to prevent duplicate AI extractions.

## How It Works

### 1. New Database Table: `ScannedConversation`
Tracks which Front conversations have already been processed:
```prisma
model ScannedConversation {
  id              Int      @id @default(autoincrement())
  conversationId  String   @unique
  subject         String?
  shipmentsFound  Int      @default(0)
  scannedAt       DateTime @default(now())
}
```

### 2. Pre-Scan Check
Before extracting with AI, we check:
```typescript
const alreadyScanned = await prisma.scannedConversation.findUnique({
  where: { conversationId: conversation.id },
})

if (alreadyScanned) {
  // Skip AI extraction - already processed!
  continue
}
```

### 3. Post-Scan Recording
After processing, we record:
```typescript
await prisma.scannedConversation.create({
  conversationId: conversation.id,
  subject: conversation.subject,
  shipmentsFound: shipmentsAddedThisConvo,
})
```

### 4. Link Shipments to Conversations
Added `frontConversationId` to shipments for traceability:
```prisma
model Shipment {
  // ...
  frontConversationId String?
  // ...
}
```

## API Usage

### Default Behavior (Skip Already Scanned)
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

Response includes:
```json
{
  "success": true,
  "summary": {
    "conversationsProcessed": 50,
    "conversationsAlreadyScanned": 35,  // 👈 Skipped AI calls!
    "shipmentsAdded": 8,
    "shipmentsSkipped": 2,
    "conversationsWithNoTracking": 5
  }
}
```

### Force Rescan (Override Cache)
```bash
curl -X POST http://localhost:3000/api/front/scan \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "force": true}'
```

Use `force: true` when:
- Testing AI extraction changes
- A conversation was updated with new messages
- You suspect a conversation was missed

## Benefits

✅ **Saves AI credits** - Only call OpenAI once per conversation  
✅ **Faster scans** - Skip already-processed conversations  
✅ **Traceability** - Know when each conversation was scanned  
✅ **Metrics** - Track how many shipments found per conversation  
✅ **Audit trail** - Link shipments back to source conversations  

## Example Savings

If you scan 100 conversations daily:
- **First scan:** 100 AI calls
- **Second scan:** ~0-10 AI calls (only new conversations)
- **Weekly savings:** ~600 AI calls avoided

At $0.001 per call (GPT-4o-mini), that's about **$0.60/week saved** per 100 conversations.

## Database Schema Changes

```sql
-- New table
CREATE TABLE scanned_conversations (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT,
  shipments_found INTEGER DEFAULT 0,
  scanned_at TIMESTAMP DEFAULT NOW()
);

-- Updated shipments table
ALTER TABLE shipments 
ADD COLUMN front_conversation_id VARCHAR(255);

CREATE INDEX idx_front_conversation ON shipments(front_conversation_id);
```

## Future Enhancements

- Add TTL/expiry for scanned conversations (re-scan after X days)
- Webhook listener to detect new messages in existing conversations
- Dashboard showing scan history and AI credit usage
