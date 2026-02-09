# Tracking Dashboard Documentation

Quick navigation to all documentation.

## 🚀 Getting Started

**New to the project?** Start here:
1. [Main README](../README.md) - Project overview, quick start, API reference
2. [Architecture Guide](architecture/DDD.md) - How the code is organized
3. [Testing Guide](architecture/TESTING.md) - Writing and running tests
4. [Setup Guides](setup/) - Deployment, webhooks, cron jobs

## 📁 Documentation Structure

### Setup Guides (`docs/setup/`)
Operational setup for deployments and integrations:
- [Deployment](setup/DEPLOYMENT.md) - Deploy to Vercel
- [Ship24 Integration](setup/SHIP24.md) - Webhook setup and tracker registration
- [Cron Jobs](setup/CRON.md) - Automated tracking updates

### Architecture (`docs/architecture/`)
How the codebase is organized:
- [DDD Overview](architecture/DDD.md) - Domain-driven design structure
- [Testing](architecture/TESTING.md) - Testing strategy and best practices
- [Logging](../lib/infrastructure/logging/README.md) - Structured logging
- [Repositories](../lib/infrastructure/repositories/README.md) - Data access layer

### Features (`docs/features/`)
Feature-specific documentation:
- [Extraction SDK](features/EXTRACTION.md) - AI-powered data extraction

### Tests (`tests/`)
Testing documentation and examples:
- [Quick Start](../tests/QUICK_START.md) - 5-minute test setup
- [Full Guide](../tests/README.md) - Complete testing documentation
- [Setup Summary](../tests/SETUP_SUMMARY.md) - What's included

## 🔧 Quick Reference

### Commands
```bash
# Development
npm run dev              # Development server
npm run build            # Production build

# Database
npx prisma studio        # Database GUI
npx prisma db push       # Update database schema

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:ui          # Interactive UI
npm run test:coverage    # Coverage report
```

### Environment Variables
```bash
# Database
DATABASE_URL=            # Vercel Postgres

# Ship24 Tracking
SHIP24_API_KEY=
SHIP24_WEBHOOK_SIGNING_SECRET=

# Testing
DATABASE_URL=            # In .env.test (separate DB)

# Logging
LOG_LEVEL=info           # trace|debug|info|warn|error|fatal

# AI Extraction
OPENAI_API_KEY=
```

### API Endpoints
- `GET /api/shipments` - List all shipments
- `POST /api/shipments` - Create shipment
- `POST /api/webhooks/ship24` - Ship24 webhook receiver
- `POST /api/cron/update-tracking` - Manual tracking update
- `POST /api/trackers/backfill` - Register existing shipments with Ship24

## 📞 Support

- **Issues:** Check [GitHub Issues](https://github.com/everest113/tracking-dashboard/issues)
- **Code Questions:** Read the architecture docs first
- **Setup Problems:** Check the setup guides
- **Testing Help:** See [tests/README.md](../tests/README.md)

---

**Last Updated:** 2026-02-09
