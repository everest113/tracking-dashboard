# Ship24 Webhook Deployment Checklist

## ✅ Pre-Deployment (COMPLETE)

- [x] Database schema updated (ship24_tracker_id field added)
- [x] Prisma client regenerated
- [x] Webhook endpoint created (`/api/webhooks/ship24`)
- [x] Tracker backfill endpoint created (`/api/trackers/backfill`)
- [x] Ship24 client updated (registration functions added)
- [x] Manual refresh updated (uses cached results)
- [x] Front scan updated (auto-registers trackers)
- [x] Manual add updated (auto-registers trackers)
- [x] UI components created (BackfillTrackers button)
- [x] Environment variables synced to Vercel (40 variables)
- [x] Documentation created (SHIP24_WEBHOOK_SETUP.md)

## 🚀 Deployment Steps

### 1. Deploy to Vercel
```bash
cd /Users/everestguerra/Dev/tracking-dashboard
git add -A
git commit -m "Add Ship24 webhook support with signature verification"
git push
```

### 2. Configure Ship24 Webhook
1. Go to: https://dashboard.ship24.com/integrations/webhook/
2. Set webhook URL to:
   ```
   https://dash.stitchi.co/api/webhooks/ship24
   ```
   **Note:** No `?secret=` parameter needed - using signature verification
3. Leave "Webhook Secret" as-is (already in env vars: `SHIP24_WEBHOOK_SIGNING_SECRET`)
4. Click "Save changes"
5. Click "Send Test Webhook" to verify

### 3. Verify Webhook
- Check Vercel logs for: `=== Ship24 Webhook Received ===`
- Look for: `✅ Ship24 signature verified`
- Confirm: `Webhook processed: {...}`

### 4. Register Existing Shipments
1. Open: https://dash.stitchi.co
2. Click **"Register Trackers"** button (top right)
3. Wait for confirmation
4. Verify in logs or database:
   ```sql
   SELECT COUNT(*) as registered 
   FROM shipments 
   WHERE ship24_tracker_id IS NOT NULL;
   ```

### 5. Test End-to-End
1. Add a test shipment manually
2. Verify `ship24_tracker_id` is set
3. Wait for Ship24 webhook (or trigger via dashboard)
4. Check status updates in real-time
5. Click "Update Tracking" to test cached refresh

## 📋 Verification Checklist

- [ ] Deployment successful (no build errors)
- [ ] Webhook URL configured in Ship24
- [ ] Test webhook sent and received (200 OK)
- [ ] Signature verification working (check logs)
- [ ] "Register Trackers" button completes successfully
- [ ] All existing shipments have `ship24_tracker_id`
- [ ] New shipments auto-register
- [ ] Real-time updates working via webhook
- [ ] Manual refresh uses cached results (< 5 seconds)
- [ ] Status changes logged correctly

## 🔍 Monitoring

### Vercel Logs
```bash
vercel logs --follow
```

Watch for:
- Webhook receipts
- Signature verification
- Status changes
- Errors or warnings

### Database Queries

**Check tracker registration:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(ship24_tracker_id) as registered,
  COUNT(*) - COUNT(ship24_tracker_id) as unregistered
FROM shipments;
```

**Recent webhook updates:**
```sql
SELECT tracking_number, status, last_checked 
FROM shipments 
WHERE last_checked > NOW() - INTERVAL '1 hour'
ORDER BY last_checked DESC 
LIMIT 20;
```

## 🐛 Troubleshooting

### Webhook not receiving updates
- Check webhook URL in Ship24 dashboard
- Verify `SHIP24_WEBHOOK_SIGNING_SECRET` matches Ship24
- Check Vercel logs for 401/500 errors
- Test webhook via Ship24 dashboard

### Tracker registration fails
- Check `SHIP24_API_KEY` is valid
- Verify carrier codes are correct
- Check API rate limits
- Review error messages in logs

### Signature verification fails
- Ensure `SHIP24_WEBHOOK_SIGNING_SECRET` is correct
- Check Ship24 dashboard for secret value
- Verify it's synced to all Vercel environments

## ✅ Success Criteria

1. ✅ All environment variables synced
2. ⏳ Deployment completes without errors
3. ⏳ Webhook URL configured and tested
4. ⏳ Test webhook received successfully
5. ⏳ Signature verification passes
6. ⏳ Tracker registration completes
7. ⏳ Real-time updates working
8. ⏳ Manual refresh < 5 seconds

---

**Current Status:** Environment variables synced ✅  
**Next Action:** Deploy to Vercel and configure webhook URL
