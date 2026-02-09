# Stitchi Tracking Dashboard

Internal shipment tracking system that provides an API-agnostic interface for managing and monitoring package deliveries.

## Features

- 🔍 Track shipments via PO number and tracking number
- 📦 Multi-carrier support (UPS, USPS, FedEx, etc.)
- 📊 Real-time status dashboard with filtering and search
- 🔄 Automated status updates via tracking APIs
- 🎯 Clean API design - no coupling to email clients

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** PlanetScale (MySQL)
- **ORM:** Prisma
- **Styling:** TailwindCSS
- **Tracking:** AfterShip API

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PlanetScale account
- AfterShip API key (500 free shipments/month)

### 1. Clone and Install

```bash
git clone https://github.com/everest113/tracking-dashboard.git
cd tracking-dashboard
npm install
```

### 2. Database Setup (PlanetScale)

1. Create a new database in PlanetScale:
   ```bash
   pscale database create tracking-dashboard
   ```

2. Create a branch for development:
   ```bash
   pscale branch create tracking-dashboard main
   ```

3. Get your connection string:
   ```bash
   pscale connect tracking-dashboard main --port 3309
   ```

4. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

5. Update `DATABASE_URL` in `.env` with your PlanetScale connection string

### 3. Run Migrations

```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

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
# Database
DATABASE_URL="mysql://user:password@host:3306/database?sslaccept=strict"

# Tracking API
AFTERSHIP_API_KEY="your-aftership-key"

# Security
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

## Next Steps

See [GitHub Issues](https://github.com/everest113/tracking-dashboard/issues) for the implementation roadmap:

1. ✅ Phase 1: Foundation & Database (Complete)
2. Phase 2: Email Scanner Integration
3. Phase 3: Tracking API Integration
4. Phase 4: Dashboard Enhancements
5. Phase 5: Automation & Cron Jobs
6. Phase 6: Admin Panel
7. Deployment

## Development

```bash
# Run development server
npm run dev

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to PlanetScale
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio
```

## Deployment

Recommended: Deploy to Vercel
1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy!

PlanetScale will automatically handle connection pooling and scaling.

## License

Internal Stitchi tool - All rights reserved
