# Cron Job Setup for Tracking Updates

This app uses **Vercel Cron Jobs** to automatically check for tracking number updates.

## How It Works

The cron job calls `/api/cron/update-tracking` on a schedule to:
1. Fetch all active (non-delivered) shipments
2. Update their tracking status via a tracking API
3. Record any new tracking events

## Configuration

### 1. Vercel Cron Schedule

The `vercel.json` file defines the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-tracking",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

**Current schedule:** Every 4 hours

**Schedule format:** Standard cron syntax
- `0 */4 * * *` - Every 4 hours (at :00)
- `0 */2 * * *` - Every 2 hours
- `*/30 * * * *` - Every 30 minutes
- `0 9,17 * * *` - Twice daily (9am and 5pm UTC)

### 2. Security

The endpoint is protected with a secret token:

**In `.env`:**
```env
CRON_SECRET=your-secret-key-here-change-this
```

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add `CRON_SECRET` with the same value
3. Vercel automatically adds this header: `Authorization: Bearer ${CRON_SECRET}`

### 3. Deploy

After pushing to Vercel:
```bash
git add vercel.json app/api/cron/
git commit -m "Add tracking update cron job"
git push
```

Vercel will automatically:
- Detect the `crons` config in `vercel.json`
- Schedule the job
- Call your endpoint with the auth header

## Testing Locally

Test the cron endpoint manually:

```bash
curl http://localhost:3002/api/cron/update-tracking \
  -H "Authorization: Bearer your-secret-key-here-change-this"
```

Expected response:
```json
{
  "success": true,
  "checked": 25,
  "updated": 25,
  "errors": 0,
  "errorMessages": [],
  "durationMs": 1234,
  "timestamp": "2024-02-08T12:00:00.000Z"
}
```

## Integrating a Tracking API

The current implementation only updates `lastChecked`. To add real tracking data:

### Option 1: EasyPost (Recommended)

```bash
npm install @easypost/api
```

Create `/lib/tracking-api.ts`:
```typescript
import EasyPost from '@easypost/api'

const client = new EasyPost(process.env.EASYPOST_API_KEY!)

export async function getTrackingStatus(trackingNumber: string, carrier: string) {
  const tracker = await client.Tracker.create({
    tracking_code: trackingNumber,
    carrier: carrier
  })
  
  return {
    status: tracker.status,
    estimatedDelivery: tracker.est_delivery_date,
    events: tracker.tracking_details.map(event => ({
      status: event.status,
      location: event.tracking_location?.city,
      message: event.message,
      timestamp: event.datetime
    }))
  }
}
```

Then update `/app/api/cron/update-tracking/route.ts`:
```typescript
import { getTrackingStatus } from '@/lib/tracking-api'

// Inside the loop:
const trackingData = await getTrackingStatus(
  shipment.trackingNumber, 
  shipment.carrier || 'auto'
)

await prisma.shipment.update({
  where: { id: shipment.id },
  data: {
    status: trackingData.status,
    estimatedDelivery: trackingData.estimatedDelivery,
    lastChecked: new Date(),
  }
})

// Save tracking events
for (const event of trackingData.events) {
  await prisma.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      status: event.status,
      location: event.location,
      message: event.message,
      eventTime: event.timestamp,
    }
  })
}
```

### Option 2: AfterShip

```bash
npm install aftership
```

Similar pattern - call their API and map the response to your schema.

### Option 3: Direct Carrier APIs

- **UPS:** UPS Tracking API
- **FedEx:** FedEx Tracking API
- **USPS:** USPS Web Tools

Each requires separate API credentials and integration.

## Monitoring

### View Cron Logs in Vercel

1. Go to your project in Vercel
2. Click **Deployments** → select latest deployment
3. Click **Functions** tab
4. Find `/api/cron/update-tracking`
5. View execution logs

### Set Up Alerts

Add error notifications in the cron handler:

```typescript
if (errors > 0) {
  // Send alert via Slack, email, etc.
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `⚠️ Tracking update cron had ${errors} errors`
    })
  })
}
```

## Limits

- **Vercel Hobby Plan:** 2 cron jobs max
- **Vercel Pro Plan:** Unlimited cron jobs
- **Execution time:** Max 60 seconds (adjust `take` limit accordingly)
- **Frequency:** Minimum 1 minute intervals

## Alternative: External Cron Service

If you prefer an external service (works with any host):

1. Use **cron-job.org** or **EasyCron**
2. Create a job that calls your endpoint:
   ```
   URL: https://your-app.vercel.app/api/cron/update-tracking
   Headers: Authorization: Bearer your-secret-key
   Schedule: */4 * * * *
   ```

This gives you more control and visibility outside Vercel.

## Troubleshooting

**Cron not running:**
- Check `vercel.json` is at project root
- Verify deployment succeeded
- Check Vercel Dashboard → Project → Settings → Crons

**Unauthorized errors:**
- Ensure `CRON_SECRET` matches in `.env` and Vercel env vars
- Check auth header is being sent

**Timeout errors:**
- Reduce `take` limit (fewer shipments per run)
- Optimize tracking API calls (batch requests if supported)
- Increase frequency, process fewer items per run
