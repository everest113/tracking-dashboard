# Test Database Setup

This guide explains how to set up databases for testing both locally and in CI.

## Quick Start (Recommended: Neon)

1. Create a Neon test database branch
2. Update `.env.test` with your connection string
3. Run: `./scripts/setup-test-db.sh`
4. Run: `npm test`

## Local Setup Options

### Option 1: Neon (Cloud Database - Easiest)

**Pros:** No local installation, works offline after initial setup
**Cons:** Requires internet connection

1. **Create test database branch:**
   - Go to Neon dashboard → Your project → Branches
   - Create branch called `test` from `main`
   - Copy connection string

2. **Update .env.test:**
   ```env
   DATABASE_URL="postgresql://user:npg_xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require"
   ```

3. **Run setup:**
   ```bash
   ./scripts/setup-test-db.sh
   npm test
   ```

### Option 2: Docker (Best for CI-like testing)

**Pros:** Isolated, repeatable, no conflicts
**Cons:** Requires Docker

```bash
# Start PostgreSQL
docker run -d \
  --name tracking-test-db \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=tracking_dashboard_test \
  -p 5433:5432 \
  postgres:15

# Update .env.test
DATABASE_URL="postgresql://test:test@localhost:5433/tracking_dashboard_test"

# Setup and run
./scripts/setup-test-db.sh
npm test

# Cleanup
docker stop tracking-test-db && docker rm tracking-test-db
```

### Option 3: Local PostgreSQL

**Pros:** Fast, works offline
**Cons:** Requires PostgreSQL installation

```bash
# Install (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb tracking_dashboard_test

# Update .env.test
DATABASE_URL="postgresql://localhost:5432/tracking_dashboard_test"

# Setup and run
./scripts/setup-test-db.sh
npm test
```

## CI/GitHub Actions

Tests run automatically in CI with PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: tracking_dashboard_test
```

No additional setup needed! ✅

## Troubleshooting

### Cannot connect

```bash
# Test connection
npx prisma db pull

# Check env
cat .env.test | grep DATABASE_URL
```

### Migrations not applied

```bash
./scripts/setup-test-db.sh
```

### Port conflicts (Docker)

```bash
# Use different port
docker run -p 5434:5432 ...
# Update DATABASE_URL to localhost:5434
```

## Useful Commands

```bash
npm test                      # Run all tests
npm test -- tests/unit/       # Unit tests only
npm run test:coverage         # With coverage
npm run test:watch            # Watch mode

npx prisma studio            # View database
npx prisma migrate reset     # ⚠️ Reset database
```
