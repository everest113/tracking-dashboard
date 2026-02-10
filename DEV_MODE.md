# Developer Mode Features

## Force Rescan

When `DEV_ALLOW_RESCAN=true` is set in environment variables, developers can force the system to rescan conversations that have already been analyzed.

### Use Cases

- **Testing extraction improvements** - Re-run AI extraction on the same emails after prompt/schema changes
- **Debugging false negatives** - Re-analyze conversations that should have had tracking but were marked as "no tracking"
- **Comparing extraction versions** - See how changes affect extraction quality

### Setup

**1. Enable in environment:**

```bash
# .env.local (local development)
DEV_ALLOW_RESCAN=true
```

**2. Use the UI:**

When in development mode (`NODE_ENV=development`), the "Sync Front Inbox" dialog shows an additional option:

```
🔄 Force rescan (Developer Mode)
Re-analyze conversations even if already scanned. Useful for testing extraction changes.
⚠️ This will use AI credits for already-scanned conversations
```

### How It Works

**Normal Sync (Production):**
```
1. Fetch conversations from Front
2. Check database for already-scanned conversation IDs
3. Filter out already-scanned conversations ✓ (saves AI credits)
4. Extract tracking from remaining conversations
5. Save to database
```

**Force Rescan (Developer Mode):**
```
1. Fetch conversations from Front
2. Skip the already-scanned check ✓ (developer override)
3. Extract tracking from ALL conversations (even if previously scanned)
4. Save to database (duplicates are still skipped by tracking number uniqueness)
```

### API Usage

**Request:**
```json
POST /api/front/scan
{
  "after": "2026-02-01",
  "forceRescan": true
}
```

**Requirements:**
- `DEV_ALLOW_RESCAN=true` must be set in environment
- If not set, `forceRescan` parameter is ignored (safety)

**Console Output:**
```
=== Front Scan Started ===
🔄 DEV MODE: Force rescanning ALL conversations (ignoring scan history)
Fetching conversations after: 2026-02-01T00:00:00.000Z
Found 50 total conversations
50 conversations need scanning (0 already scanned) [FORCE RESCAN]
Processing batch 1 (10 conversations)
...
```

### Safety Features

1. **Environment Gated** - Force rescan only works if `DEV_ALLOW_RESCAN=true`
2. **UI Warning** - Orange warning box explains AI credit usage
3. **Duplicate Protection** - Tracking numbers are unique in DB, duplicates still skipped
4. **Dev-Only Visibility** - Checkbox only visible when `NODE_ENV=development`
5. **Clear Logging** - Console shows `[FORCE RESCAN]` flag for transparency

### Cost Implications

⚠️ **OpenAI API Usage**

- Normal sync: Only processes new conversations (free if all scanned)
- Force rescan: Processes ALL conversations (costs AI credits)

**Example:**
- 50 conversations already scanned
- Normal sync: 0 API calls ($0.00)
- Force rescan: 50 API calls (~$0.05 with GPT-4o-mini)

### Testing Workflow

```bash
# 1. Make changes to extraction prompt or schema
vim lib/infrastructure/sdks/extraction/modules/shipping/prompts.ts

# 2. Reset test data (optional)
npx prisma db execute --stdin <<< "TRUNCATE scanned_conversations CASCADE;"

# 3. Run sync with force rescan enabled
# Use UI button with "Force rescan" checked

# 4. Compare results before/after your changes
```

### Production Safety

In production (Vercel):
- `DEV_ALLOW_RESCAN` is NOT set
- `forceRescan` parameter is ignored even if sent
- Always skips already-scanned conversations
- No way to accidentally waste AI credits

### Environment Variables

| Variable | Development | Production | Purpose |
|----------|-------------|------------|---------|
| `DEV_ALLOW_RESCAN` | `true` | `false` (unset) | Enable force rescan feature |
| `NODE_ENV` | `development` | `production` | Controls UI visibility |
