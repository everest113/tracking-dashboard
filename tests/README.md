# Test Suite

Comprehensive integration and E2E tests for the tracking dashboard.

## Structure

```
tests/
├── setup.ts                    # Global test setup
├── helpers/                    # Test utilities
│   ├── db.ts                  # Database test helpers
│   └── api.ts                 # API test helpers
├── fixtures/                   # Reusable test data
│   └── shipments.ts           # Sample shipments, emails, webhooks
├── integration/                # Integration tests
│   ├── repositories/          # Database layer tests
│   └── use-cases/             # Business logic tests
└── e2e/                        # End-to-end tests
    └── api/                   # Full API route tests
        ├── shipments.test.ts
        └── webhooks.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Watch mode (during development)
npm run test:watch

# Run specific test file
npm test shipments.test

# Run specific test suite
npm test -- --grep "Repository"
```

## Test Database

Tests use a separate test database configured in `.env.test`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/tracking_dashboard_test"
```

**Important:** The test database is reset before each test run!

### Setup Test Database

1. Create test database:
   ```bash
   createdb tracking_dashboard_test
   ```

2. Copy `.env.test.example` to `.env.test` and update connection string

3. Run tests (will auto-migrate):
   ```bash
   npm test
   ```

## Writing Tests

### Integration Test (Repository)

```typescript
// tests/integration/repositories/my-repository.test.ts
import { describe, it, expect } from 'vitest'
import { createTestShipment } from '../../helpers/db'

describe('MyRepository', () => {
  it('should do something', async () => {
    // Arrange
    const shipment = await createTestShipment()

    // Act
    const result = await repository.someMethod(shipment.id)

    // Assert
    expect(result).toBeDefined()
  })
})
```

### E2E Test (API Route)

```typescript
// tests/e2e/api/my-endpoint.test.ts
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/my-endpoint/route'
import { createMockRequest, assertResponse } from '../../helpers/api'

describe('GET /api/my-endpoint', () => {
  it('should return data', async () => {
    // Arrange
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/my-endpoint',
    })

    // Act
    const response = await GET(request)
    const data = await assertResponse(response, 200)

    // Assert
    expect(data).toHaveProperty('key')
  })
})
```

### Use Case Test

```typescript
// tests/integration/use-cases/my-use-case.test.ts
import { describe, it, expect } from 'vitest'
import { MyUseCase } from '@/lib/application/use-cases/MyUseCase'

describe('MyUseCase', () => {
  it('should execute successfully', async () => {
    // Arrange
    const useCase = new MyUseCase(dependencies)

    // Act
    const result = await useCase.execute(params)

    // Assert
    expect(result.success).toBe(true)
  })
})
```

## Test Helpers

### Database Helpers

```typescript
import { 
  createTestShipment,
  createTestShipments,
  createTestTrackingEvent,
  getShipmentByTracking,
  cleanDatabase,
} from '../helpers/db'

// Create one shipment
const shipment = await createTestShipment({ carrier: 'ups' })

// Create multiple shipments
const shipments = await createTestShipments(5)

// Create tracking event
const event = await createTestTrackingEvent(shipment.id)

// Query helpers
const found = await getShipmentByTracking('1Z999AA10123456784')

// Manual cleanup (auto-cleaned between tests)
await cleanDatabase()
```

### API Helpers

```typescript
import { createMockRequest, assertResponse } from '../helpers/api'

// Create mock request
const request = createMockRequest({
  method: 'POST',
  url: 'http://localhost:3000/api/test',
  body: { key: 'value' },
  headers: { 'Authorization': 'Bearer token' },
})

// Assert response status and parse body
const data = await assertResponse(response, 200)
```

### Fixtures

```typescript
import {
  TRACKING_NUMBERS,
  SAMPLE_SHIPMENTS,
  SAMPLE_TRACKING_EVENTS,
  SAMPLE_EMAILS,
  SAMPLE_SHIP24_WEBHOOKS,
} from '../fixtures/shipments'

// Use predefined data
const shipment = await createTestShipment(SAMPLE_SHIPMENTS.pending)
const email = SAMPLE_EMAILS.with_tracking
const webhook = SAMPLE_SHIP24_WEBHOOKS.status_update
```

## Best Practices

### ✅ DO

- Use descriptive test names: `it('should create shipment with valid tracking number')`
- Follow AAA pattern: Arrange, Act, Assert
- Use fixtures for consistent test data
- Test one thing per test
- Clean up external resources (files, etc.)
- Use test helpers to reduce duplication

```typescript
// ✅ Good
it('should create shipment with valid tracking number', async () => {
  // Arrange
  const trackingNumber = 'TEST123'
  
  // Act
  const shipment = await createShipment(trackingNumber)
  
  // Assert
  expect(shipment.trackingNumber).toBe(trackingNumber)
})
```

### ❌ DON'T

- Don't test implementation details
- Don't have tests depend on each other
- Don't use real API keys for external services (mock them)
- Don't commit `.env.test` with real credentials

```typescript
// ❌ Bad
it('test', async () => {
  const x = await something()
  expect(x).toBe('something')
  const y = await somethingElse()
  expect(y).toBe('other')
})
```

## Mocking External Services

For tests that would call external APIs (Ship24, OpenAI), use mocks:

```typescript
import { vi } from 'vitest'

// Mock external SDK
vi.mock('@/lib/infrastructure/sdks/ship24/client', () => ({
  Ship24Client: vi.fn().mockImplementation(() => ({
    registerTracker: vi.fn().mockResolvedValue({
      data: { tracker: { trackerId: 'mock_id' } }
    }),
  })),
}))
```

## Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

Target: 80%+ coverage for critical paths (repositories, use cases, API routes)

## CI/CD Integration

Tests run automatically on:
- Pull requests (GitHub Actions)
- Before deployment (Vercel)

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Database connection errors

- Ensure test database exists: `createdb tracking_dashboard_test`
- Check `.env.test` has correct `DATABASE_URL`
- Verify database is running

### Tests hang or timeout

- Increase timeout in `vitest.config.ts`: `testTimeout: 30000`
- Check for missing `await` in async tests
- Ensure database connections are closed

### Flaky tests

- Check for race conditions (use sequential execution)
- Ensure proper cleanup between tests
- Avoid hardcoded timestamps (use `Date.now()`)

---

**Questions?** See main [documentation](../docs/README.md)
