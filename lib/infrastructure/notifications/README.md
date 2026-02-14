# Notification Infrastructure

This directory contains the [Knock](https://knock.app) implementation of the notification system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  lib/application/notifications/                              │
│  ├── ports/                    # Interfaces (abstractions)  │
│  │   ├── NotificationService   # Workflow triggers          │
│  │   ├── ObjectRepository      # Object & subscription mgmt │
│  │   └── UserRepository        # User identification        │
│  ├── types.ts                  # Domain types               │
│  ├── ShipmentNotificationService.ts  # Shipment-specific   │
│  └── index.ts                  # Factory/singleton          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ implements
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  lib/infrastructure/notifications/knock/                     │
│  ├── KnockClient.ts            # SDK singleton              │
│  ├── KnockNotificationService  # Implements NotificationSvc │
│  ├── KnockObjectRepository     # Implements ObjectRepo      │
│  ├── KnockUserRepository       # Implements UserRepo        │
│  └── index.ts                  # Exports & singletons       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## DDD Principles Applied

### 1. Dependency Inversion
- Application layer defines interfaces (ports)
- Infrastructure layer provides implementations (adapters)
- Event handlers depend on abstractions, not Knock directly

### 2. Single Responsibility
- `KnockClient.ts` - SDK lifecycle only
- `KnockNotificationService.ts` - Workflow triggers only
- `KnockObjectRepository.ts` - Object operations only
- `KnockUserRepository.ts` - User operations only

### 3. Domain Isolation
- `ShipmentNotificationService` contains shipment-specific logic
- Infrastructure layer is generic (any collection, any workflow)
- Domain types live in application layer

## Benefits

| Aspect | Benefit |
|--------|---------|
| **Testability** | Mock interfaces in unit tests |
| **Swappability** | Replace Knock by implementing interfaces |
| **Maintainability** | Small, focused modules |
| **Clarity** | Clear boundaries between layers |

## Usage

### Event Handlers (Application Layer)

```typescript
import { getShipmentNotificationService } from '@/lib/application/notifications'

const service = getShipmentNotificationService()

// Sync shipment to notification system
await service.syncShipment(shipmentId, objectData)

// Subscribe users
await service.subscribeUsers(shipmentId, ['user-1', 'user-2'])

// Trigger notification
await service.notifyDelivered(shipmentId, notificationData, {
  tenant: 'acme-corp',
  actor: 'system',
  idempotencyKey: `${eventId}:${shipmentId}`,
})
```

### Direct Infrastructure Access (When Needed)

```typescript
import { getUserRepository } from '@/lib/infrastructure/notifications/knock'

const userRepo = getUserRepository()
await userRepo.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  timezone: 'America/New_York',
})
```

## Setup

### 1. Environment

```bash
# .env.local
KNOCK_API_KEY=sk_your_secret_key
```

### 2. Knock Dashboard

Create these workflows:
- `shipment-created`
- `shipment-status-changed`
- `shipment-delivered`
- `shipment-exception`

### 3. Development Mode

Without `KNOCK_API_KEY`:
- All operations log to console
- No external API calls
- Safe for local development

## File Structure

```
lib/
├── application/
│   └── notifications/
│       ├── ports/
│       │   ├── NotificationService.ts
│       │   ├── ObjectRepository.ts
│       │   ├── UserRepository.ts
│       │   └── index.ts
│       ├── types.ts
│       ├── ShipmentNotificationService.ts
│       └── index.ts
│
└── infrastructure/
    └── notifications/
        ├── knock/
        │   ├── KnockClient.ts
        │   ├── KnockNotificationService.ts
        │   ├── KnockObjectRepository.ts
        │   ├── KnockUserRepository.ts
        │   └── index.ts
        └── README.md
```

## Adding a New Provider

To add a different notification provider (e.g., Novu):

1. Create `lib/infrastructure/notifications/novu/`
2. Implement the three interfaces:
   - `createNovuNotificationService(): NotificationService`
   - `createNovuObjectRepository(): ObjectRepository`
   - `createNovuUserRepository(): UserRepository`
3. Update `lib/application/notifications/index.ts` to use the new provider
