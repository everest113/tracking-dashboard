# Domain-Driven Design Architecture

## Overview

The backend has been refactored to follow Domain-Driven Design (DDD) principles with clean separation of concerns and a proper SDK layer for external dependencies.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                      │
│         (Next.js API Routes - app/api/*)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│   (Use Cases + Service - lib/application/*)             │
│   • ShipmentTrackingService (Facade)                    │
│   • RegisterTrackerUseCase                              │
│   • UpdateShipmentTrackingUseCase                       │
│   • ProcessWebhookUseCase                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Domain Layer                           │
│        (Business Logic - lib/domain/*)                   │
│   • Entities (Shipment)                                  │
│   • Value Objects (TrackingNumber, ShipmentStatus)       │
│   • Repository Interfaces (ShipmentRepository)           │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                Infrastructure Layer                      │
│     (External Services - lib/infrastructure/*)           │
│   • SDKs (Ship24 with Zod validation)                    │
│   • Mappers (External DTO → Domain)                      │
│   • Repository Implementations (Prisma)                  │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
lib/
├── domain/
│   ├── entities/
│   │   └── Shipment.ts              # Core business entity
│   ├── value-objects/
│   │   ├── TrackingNumber.ts        # Validated tracking number
│   │   └── ShipmentStatus.ts        # Type-safe status
│   └── repositories/
│       └── ShipmentRepository.ts    # Repository interface (port)
│
├── application/
│   ├── ShipmentTrackingService.ts   # Application facade
│   └── use-cases/
│       ├── RegisterTrackerUseCase.ts
│       ├── UpdateShipmentTrackingUseCase.ts
│       └── ProcessWebhookUseCase.ts
│
└── infrastructure/
    ├── sdks/
    │   └── ship24/
    │       ├── schemas.ts            # Zod schemas for validation
    │       └── client.ts             # Raw API client
    ├── mappers/
    │   └── Ship24Mapper.ts           # External DTO → Domain
    └── repositories/
        └── PrismaShipmentRepository.ts # Repository implementation

app/api/                              # Presentation layer
├── trackers/backfill-v2/route.ts     # DDD version (example)
└── webhooks/ship24-v2/route.ts       # DDD version (example)
```

## Key Concepts

### Domain Layer

**Entities**: Core business objects with identity
- `Shipment`: Represents a tracked shipment with business logic

**Value Objects**: Immutable objects defined by their attributes
- `TrackingNumber`: Validated, normalized tracking number
- `ShipmentStatus`: Type-safe shipment status

**Repository Interfaces**: Define data access contracts (Dependency Inversion)

### Application Layer

**Use Cases**: Single-responsibility business operations
- Each use case represents one user action
- Orchestrates domain objects and infrastructure services

**Service (Facade)**: Simplifies use case consumption
- `ShipmentTrackingService`: Easy-to-use API for common operations

### Infrastructure Layer

**SDK**: External API client with validation
- Raw HTTP calls
- Zod schema validation
- Returns validated TypeScript types
- NO domain knowledge

**Mapper**: Transform external data to domain models
- Separate from SDK (single responsibility)
- Knows both external DTOs and domain models
- Handles status mapping, date parsing, etc.

**Repository Implementation**: Data access implementation
- Implements domain repository interface
- Uses Prisma ORM
- Converts between domain entities and database records

## Benefits

### 1. Clean Separation of Concerns
- Each layer has a single responsibility
- Easy to understand and maintain
- Changes in one layer don't affect others

### 2. Type Safety
- Zod validates external API responses
- Domain models enforce business rules
- TypeScript catches errors at compile time

### 3. Testability
- Domain logic is pure (no dependencies)
- Use cases are easy to test in isolation
- Infrastructure can be mocked

### 4. Flexibility
- Easy to swap implementations (e.g., different tracking provider)
- Domain logic is independent of external services
- Can add new use cases without changing existing code

### 5. Domain Focus
- Business logic lives in one place (domain layer)
- External concerns (API calls, DB) are isolated
- Code reads like the business domain

## Usage Examples

### Example 1: Register a Tracker

```typescript
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

const service = getShipmentTrackingService()

const result = await service.registerTracker(
  '1Z999AA10123456784',  // tracking number
  'ups',                  // carrier
  'PO-12345'              // PO number (optional)
)

if (result.success) {
  console.log(`Registered with tracker ID: ${result.trackerId}`)
} else {
  console.error(`Failed: ${result.error}`)
}
```

### Example 2: Process Webhook

```typescript
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { Ship24WebhookPayloadSchema } from '@/lib/infrastructure/sdks/ship24/schemas'

// Validate payload with Zod
const payload = Ship24WebhookPayloadSchema.parse(rawPayload)

const service = getShipmentTrackingService()
const tracking = payload.data.trackings[0]

const result = await service.processWebhook(
  tracking.tracker.trackerId,
  tracking.tracker.trackingNumber,
  tracking
)

console.log(`Status changed: ${result.statusChanged}`)
console.log(`${result.oldStatus} → ${result.newStatus}`)
```

### Example 3: Update Active Shipments

```typescript
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

const service = getShipmentTrackingService()

const results = await service.updateActiveShipments(50) // limit 50

for (const result of results) {
  if (result.statusChanged) {
    console.log(`${result.trackingNumber}: ${result.oldStatus} → ${result.newStatus}`)
  }
}
```

## Migration Guide

### Before (Old Architecture)

```typescript
// app/api/trackers/backfill/route.ts
import { registerTrackersBulk } from '@/lib/ship24-client'
import { prisma } from '@/lib/prisma'

// Tightly coupled to Prisma and Ship24 client
const shipments = await prisma.shipment.findMany({ ... })
const registrations = await registerTrackersBulk(shipments.map(...))
// Manual DB updates
```

### After (DDD Architecture)

```typescript
// app/api/trackers/backfill-v2/route.ts
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

// Clean, testable, domain-focused
const service = getShipmentTrackingService()
const result = await service.backfillTrackers()

// Service handles all orchestration
```

## Comparison: Old vs New

### Ship24 Client

**Old (`lib/ship24-client.ts`)**:
```typescript
// Mixed concerns: API calls + validation + mapping
export async function getTrackingInfo(trackingNumber, carrier) {
  const response = await fetch(...)  // HTTP call
  const data = await response.json()  // No validation
  return transformShip24Response(data)  // Mapping mixed in
}
```

**New SDK (`lib/infrastructure/sdks/ship24/client.ts`)**:
```typescript
// Single responsibility: API calls + validation only
export class Ship24Client {
  async getTrackerResults(trackerId: string) {
    const response = await this.get(`/trackers/${trackerId}/results`)
    const parsed = Ship24TrackingResponseSchema.safeParse(response)  // Zod validation
    return parsed.data  // Returns validated DTO, no domain knowledge
  }
}
```

**New Mapper (`lib/infrastructure/mappers/Ship24Mapper.ts`)**:
```typescript
// Separate responsibility: DTO → Domain transformation
export class Ship24Mapper {
  static toDomainTrackingUpdate(tracking: Ship24Tracking): TrackingUpdateData {
    const status = this.mapStatus(tracking.shipment.statusMilestone)
    // ... pure transformation logic
  }
}
```

## Testing Examples

### Test Domain Entity

```typescript
import { Shipment } from '@/lib/domain/entities/Shipment'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'

describe('Shipment', () => {
  it('should update status', () => {
    const shipment = Shipment.create({
      trackingNumber: TrackingNumber.create('1Z999AA10123456784'),
      status: ShipmentStatus.pending(),
      // ... other fields
    })

    shipment.updateStatus(ShipmentStatus.delivered())

    expect(shipment.isDelivered).toBe(true)
  })
})
```

### Test Use Case

```typescript
import { RegisterTrackerUseCase } from '@/lib/application/use-cases/RegisterTrackerUseCase'

describe('RegisterTrackerUseCase', () => {
  it('should register tracker', async () => {
    const mockRepo = { save: jest.fn() }
    const mockClient = { registerTracker: jest.fn().mockResolvedValue({ data: { tracker: { trackerId: '123' }}}) }
    
    const useCase = new RegisterTrackerUseCase(mockRepo, mockClient)
    const result = await useCase.execute({ shipment: mockShipment })

    expect(result.success).toBe(true)
    expect(result.trackerId).toBe('123')
  })
})
```

## Migration Path

1. ✅ **Phase 1: Infrastructure** (DONE)
   - Created domain entities and value objects
   - Created Ship24 SDK with Zod validation
   - Created mapper layer
   - Created repository implementations

2. ⏳ **Phase 2: Application** (IN PROGRESS)
   - Created use cases
   - Created application service
   - Created example v2 endpoints

3. 🔄 **Phase 3: Migrate Routes** (TODO)
   - Update existing API routes to use new service
   - Test each endpoint
   - Remove old code

4. 🔄 **Phase 4: Extend** (FUTURE)
   - Add more domain logic as needed
   - Add new external services (e.g., Front, OpenAI)
   - Create SDKs for other providers

## Next Steps

### To Complete Migration:

1. **Update webhook endpoint**: Replace `/api/webhooks/ship24/route.ts` with v2 version
2. **Update backfill endpoint**: Replace `/api/trackers/backfill/route.ts` with v2 version
3. **Update manual refresh**: Use `service.updateActiveShipments()`
4. **Update Front scan**: Use `service.registerTracker()` for each shipment
5. **Remove old client**: Delete `lib/ship24-client.ts` when migration complete

### Testing v2 Endpoints:

```bash
# Test backfill (DDD version)
curl -X POST http://localhost:3002/api/trackers/backfill-v2

# Test webhook (DDD version)
# Configure Ship24 to use: https://dash.stitchi.co/api/webhooks/ship24-v2
```

## Further Reading

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Zod Documentation](https://zod.dev/)
