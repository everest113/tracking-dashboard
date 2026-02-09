# Ship24 Webhook Setup Guide

## Overview

Your tracking dashboard now uses **Ship24 webhooks** for real-time shipment tracking updates, plus manual refresh for on-demand updates.

## Features Implemented

✅ **Webhook Endpoint** - Receives real-time tracking events from Ship24  
✅ **Tracker Registration** - Auto-registers new shipments  
✅ **Backfill Tool** - Registers existing shipments  
✅ **Manual Refresh** - On-demand updates from Ship24 cache  
✅ **Database Schema** - Added `ship24_tracker_id` field  

---

## 🚀 Setup Steps

### 1. Configure Webhook URL in Ship24 Dashboard

Go to: https://dashboard.ship24.com/integrations/webhook/

**Webhook URL:**
```
https://your-domain.vercel.app/api/webhooks/ship24?secret=YOUR_SECRET_HERE
```

Replace:
- `your-domain.vercel.app` with your actual Vercel domain
- `YOUR_SECRET_HERE` with the value from `SHIP24_WEBHOOK_SECRET` env var

### 2. Add Environment Variables

Add to your `.env.local` and Vercel environment variables:

```bash
# Ship24 Webhook Security
SHIP24_WEBHOOK_SECRET=your-secure-random-string-here
```

**Generate a secure secret:**
```bash
openssl rand -base64 32
```

### 3. Register Existing Shipments

After deploying, click the **"Register Trackers"** button in the dashboard UI to backfill all existing shipments.

This creates Ship24 trackers for all shipments that don't have a `ship24_tracker_id` yet.

---

## 🔄 How It Works

### Automatic Tracker Registration

**When you add a new shipment:**
1. Dashboard creates shipment in database
2. Registers tracker with Ship24 API
3. Stores `ship24_tracker_id` for future updates
4. Ship24 starts tracking automatically

**Tracking sources:**
- Front inbox sync → auto-registers
- Manual shipment addition → auto-registers

### Real-Time Webhook Updates

**When Ship24 detects a tracking event:**
1. Ship24 sends POST request to `/api/webhooks/ship24`
2. Webhook validates secret token
3. Updates shipment status, dates, and events in database
4. Stores new tracking events if available

**No polling needed!** Updates arrive within seconds of courier updates.

### Manual Refresh

**When you click "Update Tracking":**
- Fetches latest tracking data from Ship24's **cached results** (fast)
- Does NOT re-query the courier (efficient, no API waste)
- Updates all non-delivered shipments

---

## 📊 Database Changes

### New Field: `ship24_tracker_id`

```sql
ALTER TABLE shipments ADD COLUMN ship24_tracker_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_ship24_tracker ON shipments(ship24_tracker_id);
```

**Purpose:**
- Stores Ship24's unique tracker identifier
- Enables fast lookups for webhook processing
- Required for cached result queries

---

## 🔒 Security

### Webhook Secret Token

The `?secret=` query parameter provides basic security:

- Only requests with correct secret are processed
- Invalid secret → 401 Unauthorized
- Secret is NOT logged

**Best practices:**
- Use a strong random string (32+ characters)
- Store in environment variables only
- Rotate periodically

### HEAD Request Support

Ship24 validates webhook URLs with a HEAD request before saving.

The webhook endpoint returns `200 OK` for HEAD requests (no auth required).

---

## 🛠️ API Endpoints

### Webhook Receiver
```
POST /api/webhooks/ship24?secret=YOUR_SECRET
```
Receives tracking updates from Ship24.

### Tracker Backfill
```
POST /api/trackers/backfill
```
Registers all untracked shipments with Ship24.

### Manual Refresh
```
POST /api/manual-update-tracking
```
Fetches latest cached results for active shipments.

---

## 🔍 Monitoring & Debugging

### Check Webhook Logs

**Vercel:**
1. Go to your project dashboard
2. Click "Logs" tab
3. Filter for `/api/webhooks/ship24`

**Look for:**
- `=== Ship24 Webhook Received ===`
- `✅ Status changed: X → Y`
- `🎉 DELIVERED: tracking#`

### Test Webhook Integration

Ship24 Dashboard → Integrations → Webhook → **Send Test Webhook**

This sends a dummy tracking event to verify your endpoint works.

### Check Tracker Registration

Run in your database:
```sql
SELECT 
  COUNT(*) as total_shipments,
  COUNT(ship24_tracker_id) as registered,
  COUNT(*) - COUNT(ship24_tracker_id) as unregistered
FROM shipments;
```

---

## 📈 Benefits

| Feature | Before (Polling) | After (Webhooks) |
|---------|------------------|------------------|
| **Update Speed** | 15-60 minutes | Real-time (seconds) |
| **API Calls** | ~1 per shipment per hour | Only when status changes |
| **Server Load** | Constant polling | Event-driven |
| **Cost** | High API usage | Low API usage |
| **Accuracy** | Delayed | Instant |

---

## 🐛 Troubleshooting

### Shipments not receiving updates

**Check:**
1. Is `ship24_tracker_id` set? (If not, click "Register Trackers")
2. Is webhook URL configured in Ship24 dashboard?
3. Is `SHIP24_WEBHOOK_SECRET` set correctly?
4. Check Vercel logs for webhook errors

### Tracker registration fails

**Common causes:**
- Invalid `SHIP24_API_KEY`
- Carrier code not recognized by Ship24
- Tracking number already registered elsewhere

**Solution:**
- Check console logs for specific error
- Verify carrier codes match Ship24's format (lowercase: `usps`, `fedex`, `ups`, etc.)

### Webhook returns 401 Unauthorized

**Cause:** Secret mismatch

**Fix:**
1. Check `SHIP24_WEBHOOK_SECRET` in Vercel env vars
2. Update webhook URL in Ship24 dashboard with correct secret
3. Redeploy if needed

---

## 🔄 Migration Summary

### Files Changed

- ✅ `prisma/schema.prisma` - Added `ship24_tracker_id` field
- ✅ `lib/ship24-client.ts` - Added tracker registration functions
- ✅ `app/api/webhooks/ship24/route.ts` - NEW webhook endpoint
- ✅ `app/api/trackers/backfill/route.ts` - NEW backfill endpoint
- ✅ `app/api/shipments/route.ts` - Auto-register on creation
- ✅ `app/api/front/scan/route.ts` - Auto-register from Front
- ✅ `app/api/manual-update-tracking/route.ts` - Use cached results
- ✅ `components/BackfillTrackers.tsx` - NEW backfill UI
- ✅ `app/page.tsx` - Added backfill button

### Environment Variables

```bash
# Already configured
SHIP24_API_KEY=apik_...

# NEW - Add this
SHIP24_WEBHOOK_SECRET=your-secure-random-string
```

---

## 🎯 Next Steps

1. ✅ Deploy to Vercel
2. ✅ Add `SHIP24_WEBHOOK_SECRET` to Vercel env vars
3. ✅ Configure webhook URL in Ship24 dashboard
4. ✅ Click "Register Trackers" button to backfill existing shipments
5. ✅ Test webhook with Ship24's test feature
6. ✅ Monitor logs to confirm webhooks are working

---

## 📞 Support

- **Ship24 Docs:** https://docs.ship24.com/webhooks/overview
- **Ship24 Dashboard:** https://dashboard.ship24.com
- **API Reference:** https://docs.ship24.com/tracking-api-reference/

---

## 🎉 Success Criteria

You'll know it's working when:

✅ New shipments show `ship24_tracker_id` in database  
✅ Webhook logs appear in Vercel console  
✅ Tracking status updates within seconds of courier updates  
✅ "Register Trackers" shows 0 unregistered shipments  
✅ Manual refresh completes in <5 seconds (using cache)  

Enjoy your real-time tracking dashboard! 🚀
