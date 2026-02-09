# Testing Architecture

Comprehensive testing strategy for the tracking dashboard.

## Test Pyramid

```
        /\
       /  \      E2E Tests (Few)
      /────\     ├─ Full API routes
     /      \    └─ Webhook flows
    /────────\   
   / Integration\ Integration Tests (Many)
  /      Tests   \├─ Repositories + DB
 /────────────────\├─ Use cases
/   Unit Tests     \└─ Domain entities
\__________________/
```

## Test Types

### Unit Tests
**What:** Pure functions, domain logic  
**Where:** Domain entities, value objects  
**Fast:** Yes (no I/O)

### Integration Tests
**What:** Database operations, use cases  
**Where:** Repositories, application layer  
**Fast:** Moderate (uses test DB)

### E2E Tests
**What:** Full API routes, complete flows  
**Where:** API endpoints, webhooks  
**Fast:** Slower (full stack)

## Test Database Strategy

### Isolated Test DB
Each test run uses a fresh database schema:

```typescript
// tests/setup.ts
beforeAll(async () => {
  // Reset schema
  execSync('npx prisma db push --force-reset')
})

beforeEach(async () => {
  // Clean all data between tests
  await cleanDatabase()
})
```

**Benefits:**
- Tests don't interfere with each other
- Predictable state
- Safe to run in parallel (with caution)

### Test Data Strategy

1. **Fixtures** - Reusable test data (`tests/fixtures/`)
2. **Helpers** - Data creation utilities (`tests/helpers/db.ts`)
3. **Factories** - Generate test data programmatically

```typescript
// Use fixtures for consistency
const shipment = await createTestShipment(SAMPLE_SHIPMENTS.pending)

// Or generate unique data
const shipment = await createTestShipment({
  tracking_number: `TEST${Date.now()}`,
})
```

## Test Organization

```
tests/
├── setup.ts                    # Global setup/teardown
├── helpers/                    # Test utilities
│   ├── db.ts                  # Database helpers
│   └── api.ts                 # API mocking helpers
├── fixtures/                   # Reusable test data
│   └── shipments.ts
├── integration/                # Integration tests
│   ├── repositories/          # Test DB layer
│   └── use-cases/             # Test business logic
└── e2e/                        # End-to-end tests
    └── api/                   # Test API routes
```

## Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should update shipment status', async () => {
  // Arrange - Set up test data
  const shipment = await createTestShipment({ status: 'pending' })
  
  // Act - Execute the operation
  const updated = await repository.updateStatus(shipment.id, 'in_transit')
  
  // Assert - Verify the result
  expect(updated.status).toBe('in_transit')
})
```

### 2. Test One Thing

```typescript
// ✅ Good - One assertion
it('should create shipment', async () => {
  const shipment = await createShipment('TEST123')
  expect(shipment.id).toBeGreaterThan(0)
})

it('should set status to pending', async () => {
  const shipment = await createShipment('TEST123')
  expect(shipment.status).toBe('pending')
})

// ❌ Bad - Multiple unrelated assertions
it('should work', async () => {
  const shipment = await createShipment('TEST123')
  expect(shipment.id).toBeGreaterThan(0)
  expect(shipment.status).toBe('pending')
  expect(shipment.carrier).toBe('ups')
})
```

### 3. Descriptive Names

```typescript
// ✅ Good
it('should return null when shipment not found')
it('should prevent duplicate tracking numbers')
it('should update status via webhook')

// ❌ Bad
it('test1')
it('works')
it('should handle edge case')
```

### 4. Avoid Test Dependencies

```typescript
// ❌ Bad - Tests depend on order
let shipmentId: number

it('creates shipment', async () => {
  const shipment = await create()
  shipmentId = shipment.id  // State leaks to next test
})

it('updates shipment', async () => {
  await update(shipmentId)  // Depends on previous test
})

// ✅ Good - Each test is independent
it('creates shipment', async () => {
  const shipment = await create()
  expect(shipment.id).toBeGreaterThan(0)
})

it('updates shipment', async () => {
  const shipment = await create()  // Create own data
  await update(shipment.id)
})
```

### 5. Mock External Services

Don't call real APIs in tests:

```typescript
// ❌ Bad - Calls real Ship24 API
it('registers tracker', async () => {
  const result = await ship24Client.register('TEST123')
  expect(result).toBeDefined()
})

// ✅ Good - Mocked
vi.mock('@/lib/infrastructure/sdks/ship24/client')

it('registers tracker', async () => {
  const mockRegister = vi.fn().mockResolvedValue({ trackerId: 'mock' })
  const result = await mockRegister('TEST123')
  expect(result.trackerId).toBe('mock')
})
```

## Running Tests

```bash
# All tests
npm test

# Watch mode (development)
npm run test:watch

# With coverage
npm run test:coverage

# With UI
npm run test:ui

# Specific file
npm test shipments.test

# Specific suite
npm test -- --grep "Repository"
```

## Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Domain | 90%+ | Pure logic, critical |
| Application | 80%+ | Business rules |
| Infrastructure | 70%+ | Integration points |
| Presentation | 60%+ | API contracts |

**Focus:** High coverage on business logic, pragmatic on infrastructure.

## CI/CD Integration

Tests run automatically:

1. **Pre-commit** (optional) - Run unit tests
2. **Pull Request** - Run all tests
3. **Pre-deploy** - Run all tests + coverage

```yaml
# .github/workflows/test.yml
name: Test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
```

## Performance

### Speed Optimization

1. **Sequential vs Parallel**
   - Integration tests: Sequential (safer for DB)
   - Unit tests: Parallel (no shared state)

2. **Database Transactions**
   - Consider using transactions for faster cleanup
   - Rollback instead of delete (faster)

3. **Test Data**
   - Keep fixtures small
   - Only create what you need

### Timeout Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000,  // 30 seconds
  },
})

// Per-test override
it('slow operation', async () => {
  // ...
}, { timeout: 60000 })
```

## Debugging Tests

### Run Single Test

```bash
# By name pattern
npm test -- --grep "should create shipment"

# By file
npm test shipments.test.ts
```

### Debug in VS Code

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test"],
  "console": "integratedTerminal"
}
```

### View Database State

```typescript
it('debug test', async () => {
  const shipment = await createTestShipment()
  
  // Check database directly
  const all = await prisma.shipments.findMany()
  console.log('DB state:', all)
  
  // Or use Prisma Studio
  // npx prisma studio (in another terminal)
})
```

## Common Patterns

### Testing Error Cases

```typescript
it('should throw on invalid tracking number', async () => {
  await expect(
    createShipment('invalid')
  ).rejects.toThrow('Invalid tracking number')
})
```

### Testing Async Operations

```typescript
it('should handle concurrent updates', async () => {
  const shipment = await createTestShipment()
  
  // Run concurrently
  await Promise.all([
    updateShipment(shipment.id, { status: 'in_transit' }),
    updateShipment(shipment.id, { carrier: 'ups' }),
  ])
  
  const updated = await getShipment(shipment.id)
  expect(updated.status).toBe('in_transit')
  expect(updated.carrier).toBe('ups')
})
```

### Testing Webhooks

```typescript
it('should process webhook', async () => {
  const shipment = await createTestShipment({
    ship24_tracker_id: 'tracker123',
  })

  const webhook = SAMPLE_SHIP24_WEBHOOKS.status_update
  const request = createMockRequest({
    method: 'POST',
    body: webhook,
  })

  const response = await POST(request)
  expect(response.status).toBe(200)

  const updated = await getShipment(shipment.id)
  expect(updated.status).toBe('in_transit')
})
```

---

See [tests/README.md](../../tests/README.md) for detailed usage guide.
