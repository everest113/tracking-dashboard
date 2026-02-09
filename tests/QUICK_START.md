# Quick Start - Testing

Get your test suite running in 5 minutes.

## 1. Setup Test Database

```bash
# Create test database
createdb tracking_dashboard_test

# Or with Docker
docker run --name tracking-test-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=tracking_dashboard_test -p 5433:5432 -d postgres
```

## 2. Configure Environment

```bash
# Copy example
cp .env.test.example .env.test

# Edit .env.test
# Update DATABASE_URL to point to your test database
```

## 3. Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# With UI
npm run test:ui

# With coverage
npm run test:coverage
```

## 4. Verify Setup

You should see:

```
✓ tests/integration/example.test.ts (3)
  ✓ Example Integration Test (3)
    ✓ should create a test shipment
    ✓ should have clean database between tests
    ✓ should create multiple shipments

Test Files  1 passed (1)
     Tests  3 passed (3)
```

## Next Steps

1. **Read** [tests/README.md](README.md) for full documentation
2. **Review** example tests in `tests/integration/` and `tests/e2e/`
3. **Write** your first test using the patterns shown
4. **Check** coverage with `npm run test:coverage`

## Common Issues

### "Cannot connect to database"

- Ensure test database exists
- Check `.env.test` has correct connection string
- Verify database is running

### "Tests hang"

- Check for missing `await` in async tests
- Ensure Prisma client is properly disconnected

### "Tests fail randomly"

- Run sequentially: tests run in sequence by default
- Check for proper cleanup between tests
- Avoid hardcoded test data

---

**Need help?** See [docs/architecture/TESTING.md](../docs/architecture/TESTING.md)
