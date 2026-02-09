# Stitchi Tracking Dashboard

Real-time shipment tracking dashboard with AI-powered email extraction and Ship24 integration.

## Features

- 🔍 Track shipments by PO number and tracking number
- 📦 Multi-carrier support (UPS, USPS, FedEx, DHL, etc.)
- 🤖 AI-powered tracking extraction from emails
- 📊 Real-time status dashboard with filtering and search
- 🔄 Automated updates via Ship24 webhooks
- 💰 **100% Free** - Runs on Vercel free tier

## Quick Start

### Prerequisites

- Node.js 18+
- Vercel account (free)
- Ship24 API key ([sign up](https://ship24.com))
- OpenAI API key (for email extraction)

### Installation

```bash
git clone <your-repo>
cd tracking-dashboard
npm install
```

### Setup

1. **Create `.env.local`:**
   ```bash
   # Database (from Vercel)
   DATABASE_URL=
   
   # Ship24
   SHIP24_API_KEY=
   SHIP24_WEBHOOK_SIGNING_SECRET=
   
   # OpenAI
   OPENAI_API_KEY=
   
   # Cron Security
   CRON_SECRET=
   
   # Logging
   LOG_LEVEL=info
   ```

2. **Initialize database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000)

## Documentation

📚 **[Complete Documentation](docs/README.md)** - All guides organized by topic

### Quick Links

- **[Getting Started](docs/README.md)** - New to the project? Start here
- **[Architecture](docs/architecture/DDD.md)** - How the code is organized
- **[Deployment](docs/setup/DEPLOYMENT.md)** - Deploy to Vercel
- **[Ship24 Setup](docs/setup/SHIP24.md)** - Configure tracking webhooks
- **[Cron Jobs](docs/setup/CRON.md)** - Automated tracking updates

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Database:** Vercel Postgres (PostgreSQL)
- **ORM:** Prisma
- **Tracking:** Ship24 API
- **AI Extraction:** OpenAI GPT-4
- **Styling:** TailwindCSS
- **Deployment:** Vercel

## Project Structure

```
tracking-dashboard/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   └── page.tsx           # Dashboard UI
├── components/            # React components
├── lib/
│   ├── domain/           # Business logic (DDD)
│   ├── application/      # Use cases
│   └── infrastructure/   # External services
│       ├── sdks/         # API clients
│       ├── repositories/ # Data access
│       └── logging/      # Structured logging
├── prisma/
│   └── schema.prisma     # Database schema
└── docs/                  # Documentation
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shipments` | GET | List all shipments |
| `/api/shipments` | POST | Create new shipment |
| `/api/webhooks/ship24` | POST | Receive Ship24 tracking updates |
| `/api/cron/update-tracking` | POST | Manual tracking update |
| `/api/trackers/backfill` | POST | Register existing shipments with Ship24 |
| `/api/front/scan` | POST | Scan Front inbox for tracking numbers |

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma db push       # Push schema changes
npx prisma generate      # Generate Prisma client

# Deployment
git push                 # Auto-deploys to Vercel
```

## Environment Variables

```bash
# Database
DATABASE_URL=               # Vercel Postgres connection string

# Ship24 Tracking
SHIP24_API_KEY=            # API key from Ship24 dashboard
SHIP24_WEBHOOK_SIGNING_SECRET=  # Webhook secret from Ship24

# OpenAI (Email Extraction)
OPENAI_API_KEY=            # API key from OpenAI

# Cron Job Security
CRON_SECRET=               # Random string for cron endpoint auth

# Logging (Optional)
LOG_LEVEL=info             # trace|debug|info|warn|error|fatal
SERVICE_NAME=tracking-dashboard
```

## Shipment Status Values

- `pending` - Created but not yet picked up
- `in_transit` - Package is on the way
- `out_for_delivery` - Out for delivery today
- `delivered` - Successfully delivered
- `exception` - Issue or delay reported
- `failed_attempt` - Delivery attempt failed

## Database Schema

```sql
-- Shipments
CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(255),
  tracking_number VARCHAR(255) UNIQUE NOT NULL,
  carrier VARCHAR(100),
  supplier VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  ship24_tracker_id VARCHAR(255) UNIQUE,
  origin TEXT,
  destination TEXT,
  shipped_date TIMESTAMP,
  estimated_delivery TIMESTAMP,
  delivered_date TIMESTAMP,
  last_checked TIMESTAMP,
  front_conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tracking Events (history)
CREATE TABLE tracking_events (
  id SERIAL PRIMARY KEY,
  shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
  status VARCHAR(50),
  location TEXT,
  message TEXT,
  event_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Front Inbox Scan History
CREATE TABLE scanned_conversations (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT,
  shipments_found INT DEFAULT 0,
  scanned_at TIMESTAMP DEFAULT NOW()
);
```

## Architecture

This project follows Domain-Driven Design (DDD) principles:

- **Domain Layer** - Pure business logic (entities, value objects)
- **Application Layer** - Use cases and orchestration
- **Infrastructure Layer** - External services (API clients, database, logging)
- **Presentation Layer** - API routes and UI

See [Architecture Guide](docs/architecture/DDD.md) for details.

## Support

- **Documentation:** [docs/README.md](docs/README.md)
- **Issues:** [GitHub Issues](https://github.com/everest113/tracking-dashboard/issues)
- **Ship24 Docs:** https://docs.ship24.com

## License

Internal Stitchi tool - All rights reserved
