# Environment Variables Sync Status

## ✅ All Variables Synced to Vercel

Last verified: $(date)

### Application Variables (All Environments: Production, Preview, Development)

| Variable | Status | Purpose |
|----------|--------|---------|
| `SHIP24_API_KEY` | ✅ | Ship24 API authentication |
| `SHIP24_WEBHOOK_SECRET` | ✅ | URL-based webhook auth (backward compat) |
| `SHIP24_WEBHOOK_SIGNING_SECRET` | ✅ | Ship24 signature verification (secure) |
| `FRONT_API_TOKEN` | ✅ | Front inbox API access |
| `FRONT_SUPPLIERS_INBOX` | ✅ | Front inbox name filter |
| `OPENAI_API_KEY` | ✅ | AI tracking extraction |
| `CRON_SECRET` | ✅ | Cron job authentication |
| `SHIPSTATION_API_KEY` | ✅ | Legacy (can be removed) |

### Database Variables (All Environments)

| Variable | Status | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | ✅ | Primary Postgres connection (pooled) |
| `DATABASE_URL_UNPOOLED` | ✅ | Direct Postgres connection |
| `POSTGRES_URL` | ✅ | Neon pooled URL |
| `POSTGRES_URL_NON_POOLING` | ✅ | Neon direct URL |
| `POSTGRES_URL_NO_SSL` | ✅ | Postgres without SSL |
| `POSTGRES_PRISMA_URL` | ✅ | Prisma connection URL |
| `POSTGRES_HOST` | ✅ | Database host |
| `POSTGRES_DATABASE` | ✅ | Database name |
| `POSTGRES_USER` | ✅ | Database user |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `PGHOST` | ✅ | Postgres host (alt) |
| `PGHOST_UNPOOLED` | ✅ | Postgres unpooled host |
| `PGDATABASE` | ✅ | Database name (alt) |
| `PGUSER` | ✅ | Database user (alt) |
| `PGPASSWORD` | ✅ | Database password (alt) |
| `NEON_PROJECT_ID` | ✅ | Neon project identifier |

### Excluded Variables

| Variable | Reason |
|----------|--------|
| `VERCEL_OIDC_TOKEN` | Auto-provided by Vercel, not manually added |

---

## Deployment Ready ✅

All required environment variables are configured in Vercel across all environments:
- ✅ Production
- ✅ Preview
- ✅ Development

The application is ready to deploy with full Ship24 webhook support.
