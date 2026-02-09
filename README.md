# Stitchi Tracking Dashboard

Internal shipment tracking system that provides an API-agnostic interface for managing and monitoring package deliveries.

## Features

- 🔍 Track shipments via PO number and tracking number
- 📦 Multi-carrier support (UPS, USPS, FedEx, etc.)
- 📊 Real-time status dashboard with filtering and search
- 🔄 Automated status updates via tracking APIs
- 🎯 Clean API design - no coupling to email clients
- 💰 **100% Free** - Uses Vercel's free Postgres tier

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** Vercel Postgres (PostgreSQL via Neon) - FREE tier
- **ORM:** Prisma
- **Styling:** TailwindCSS
- **Tracking:** AfterShip API (500 free shipments/month)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Vercel account (free)
- AfterShip API key (optional for Phase 3)

### 1. Clone and Install

```bash
git clone https://github.com/everest113/tracking-dashboard.git
cd tracking-dashboard
npm install
```

### 2. Database Setup (Vercel Postgres - FREE)

#### Option A: Via Vercel Dashboard (Recommended)

1. Push your code to GitHub
2. Import project to Vercel: https://vercel.com/new
3. In Vercel Dashboard, go to **Storage** tab
4. Click **Create Database** → Select **Postgres**
5. Vercel will automatically create a free Neon-powered database
6. Click **Copy Snippet** to copy environment variables
7. Add to your local `.env` file

#### Option B: Local Development Setup

1. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Get your database URL from Vercel:
   - Go to your project in Vercel
   - Navigate to **Storage** > **Postgres** > **.env.local** tab
   - Copy the `DATABASE_URL` value
   - Paste into your local `.env`

3. Run migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

### 4. Deploy to Vercel

```bash
# If you haven't linked your project yet:
npx vercel link

# Deploy:
npx vercel --prod
```

Or push to GitHub and Vercel will auto-deploy!

## Vercel Postgres Free Tier

Perfect for low-volume tracking:

| Resource | Free Tier Limit | Your Usage (Estimated) |
|----------|-----------------|------------------------|
| Storage | 512 MB | ~10-50 MB (thousands of shipments) |
| Compute | 190 hours/month | ~10-20 hours (light API + cron) |
| Projects | 10 databases | 1 needed |
| **Cost** | **$0/month** | ✅ Fits comfortably |

## API Endpoints

### GET `/api/shipments`
Fetch all shipments (most recent first, max 100)

**Response:**
```json
[
  {
    "id": 1,
    "poNumber": "PO-12345",
    "trackingNumber": "1Z999AA10123456784",
    "carrier": "ups",
    "status": "in_transit",
    "shippedDate": "2024-02-08T10:00:00Z",
    "estimatedDelivery": "2024-02-10T17:00:00Z",
    "deliveredDate": null,
    "lastChecked": "2024-02-08T15:30:00Z"
  }
]
```

### POST `/api/shipments`
Create a new shipment

**Request:**
```json
{
  "poNumber": "PO-12345",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "ups"
}
```

**Response:**
```json
{
  "id": 1,
  "poNumber": "PO-12345",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "ups",
  "status": "pending",
  "createdAt": "2024-02-08T16:00:00Z",
  "updatedAt": "2024-02-08T16:00:00Z"
}
```

## Shipment Status Values

- `pending` - Created but not yet picked up
- `in_transit` - Package is on the way
- `out_for_delivery` - Out for delivery today
- `delivered` - Successfully delivered
- `exception` - Issue or delay reported
- `failed_attempt` - Delivery attempt failed

## Environment Variables

```env
# Database (auto-populated by Vercel)
DATABASE_URL="postgres://default:xxx@ep-xxx-pooler.us-east-1.aws.neon.tech/verceldb?sslmode=require"

# Tracking API (for Phase 3)
AFTERSHIP_API_KEY="your-aftership-key"

# Security (for Phase 5 - cron jobs)
CRON_SECRET="random-secret-for-cron-endpoints"
```

## Project Structure

```
tracking-dashboard/
├── app/
│   ├── api/
│   │   └── shipments/
│   │       └── route.ts          # Shipment CRUD API
│   ├── page.tsx                  # Dashboard homepage
│   └── layout.tsx
├── components/
│   └── ShipmentTable.tsx         # Main table component
├── lib/
│   └── prisma.ts                 # Prisma client singleton
├── prisma/
│   └── schema.prisma             # Database schema
└── README.md
```

## Database Schema

```sql
-- Shipments table
CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(255) NOT NULL,
  tracking_number VARCHAR(255) UNIQUE NOT NULL,
  carrier VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  origin TEXT,
  destination TEXT,
  shipped_date TIMESTAMP,
  estimated_delivery TIMESTAMP,
  delivered_date TIMESTAMP,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tracking events (history)
CREATE TABLE tracking_events (
  id SERIAL PRIMARY KEY,
  shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
  status VARCHAR(50),
  location TEXT,
  message TEXT,
  event_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_po_number ON shipments(po_number);
CREATE INDEX idx_status ON shipments(status);
CREATE INDEX idx_shipment_id ON tracking_events(shipment_id);
```

## Development Roadmap

See [GitHub Issues](https://github.com/everest113/tracking-dashboard/issues):

- ✅ **Phase 1:** Foundation & Database Setup (Complete)
- 🔜 **Phase 2:** Front Email Scanner Integration
- 🔜 **Phase 3:** Tracking API Integration (AfterShip)
- 🔜 **Phase 4:** Dashboard UI Enhancements
- 🔜 **Phase 5:** Automation & Cron Jobs
- 🔜 **Phase 6:** Admin Panel & Monitoring
- 🔜 **Phase 7:** Production Deployment

## Development Commands

```bash
# Run development server
npm run dev

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio

# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod
```

## Troubleshooting

### Database Connection Issues

If you get connection errors:

1. Verify your `DATABASE_URL` in `.env` matches Vercel's
2. Check that you're using the **pooler connection string** (has `-pooler` in the URL)
3. Ensure `?sslmode=require` is at the end of the connection string
4. Run `npx prisma generate` after any schema changes

### Vercel Deployment Issues

- Environment variables must be set in Vercel Dashboard (Settings > Environment Variables)
- Database is auto-linked when created via Vercel Storage tab
- Make sure to run `npx prisma generate` in your build command

## License

Internal Stitchi tool - All rights reserved

---

**Questions?** Check the [Issues](https://github.com/everest113/tracking-dashboard/issues) or create a new one!
