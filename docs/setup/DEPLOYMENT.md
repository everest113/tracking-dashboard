# Deployment Guide

## Prerequisites

- GitHub repository
- Vercel account (free tier works)
- Environment variables ready

## Quick Deploy

### 1. Import to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Vercel auto-detects Next.js settings
4. Click "Deploy"

### 2. Set Up Database

1. In Vercel Dashboard → Storage tab
2. Click "Create Database" → "Postgres"
3. Vercel creates a free Neon database
4. Database URL is automatically added to environment variables

### 3. Run Database Migrations

In your local terminal:
```bash
npx vercel env pull .env.local
npx prisma generate
npx prisma db push
```

### 4. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

**Required:**
```bash
# Database (auto-added by Vercel)
DATABASE_URL=

# Ship24
SHIP24_API_KEY=
SHIP24_WEBHOOK_SIGNING_SECRET=

# Cron Security
CRON_SECRET=

# OpenAI (for extraction)
OPENAI_API_KEY=
```

**Optional:**
```bash
# Logging
LOG_LEVEL=info

# Service Name
SERVICE_NAME=tracking-dashboard
```

### 5. Redeploy

```bash
# Trigger redeploy after adding env vars
git commit --allow-empty -m "Trigger redeploy"
git push
```

Or click "Redeploy" in Vercel Dashboard.

## Post-Deployment

### 1. Configure Ship24 Webhook
See [Ship24 Setup](SHIP24.md) for webhook configuration.

### 2. Register Existing Shipments
Click "Register Trackers" button in the dashboard.

### 3. Verify Everything Works

- [ ] Dashboard loads
- [ ] Can add a shipment manually
- [ ] Ship24 tracker ID is set
- [ ] Webhook receives updates (check Vercel logs)
- [ ] Cron job runs successfully

## Troubleshooting

**Build fails:**
- Check `npx prisma generate` runs in build command
- Verify all environment variables are set
- Review build logs in Vercel

**Database connection errors:**
- Use the **pooler connection string** (has `-pooler` in URL)
- Ensure `?sslmode=require` is at the end
- Check database is in the same region as deployment

**Environment variables not working:**
- Redeploy after adding/updating env vars
- Check they're set for "Production" environment
- Verify no typos in variable names

## Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Update Ship24 webhook URL with new domain

## Monitoring

### View Logs
```bash
vercel logs --follow
```

Or in Vercel Dashboard → Deployments → Latest → Logs

### Database GUI
```bash
npx prisma studio
```

### Health Check
Visit: `https://your-domain.vercel.app/api/shipments`

Should return JSON array of shipments.

---

**Vercel Docs:** https://vercel.com/docs
