# Database Setup

## Overview

This project uses **Neon** (Postgres) with branch-based development:

- **Production**: `ep-cool-hill-ait8vahf` (deployed via Vercel)
- **Development**: `ep-spring-river-ai2ixkim` (local development)

## Local Development

Your local environment (`.env` and `.env.local`) is configured to use the **development branch**.

### Connection String
```
postgresql://neondb_owner:npg_EI3MxoiDL8tz@ep-spring-river-ai2ixkim-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Verify Connection
```bash
npm run db:studio  # Opens Prisma Studio
# or
npx prisma db execute --stdin <<< "SELECT 1;"
```

## Vercel Deployment

**Production and Preview** environments use the production database via Vercel environment variables.

**Development** environment in Vercel still points to production (shared across all environments). Local development uses `.env` / `.env.local` which override Vercel's settings.

## Database Operations

### Run Migrations (Development)
```bash
npx prisma migrate dev
```

### Reset Development Database
```bash
npx prisma migrate reset
```

⚠️ **Never run migrations or resets on production!**

## Important Files

- `.env` - Development database (gitignored)
- `.env.local` - Development database + API keys (gitignored)
- `.env.vercel.production` - Production database (gitignored, pulled from Vercel)
- `DATABASE_URL` in Vercel - Production database (encrypted)

## Safety

✅ Local development is **isolated** from production  
✅ Test data stays in dev branch  
✅ Can reset/destroy dev database without affecting production
