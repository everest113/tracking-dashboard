# Type-Safe Repository Pattern

Eliminates `any` casts when converting between Prisma (snake_case) and domain (camelCase) types.

## Problem

Prisma uses `snake_case` while domain uses `camelCase`. Casting with `as any` bypasses type checking.

## Solution

Explicit mapper functions provide full type safety.

## Pattern

### 1. Define Types (types.ts)

```typescript
import type { Prisma } from '@prisma/client'

// Prisma type exports
export type PrismaShipment = Prisma.shipmentsGetPayload<{}>
export type PrismaShipmentCreate = Prisma.shipmentsCreateInput
```

### 2. Create Mappers (mappers.ts)

```typescript
import type { PrismaShipment } from './types'
import type { ShipmentRecord } from '@/lib/domain/entities/Shipment'

// Prisma → Domain
export function prismaShipmentToRecord(prisma: PrismaShipment): ShipmentRecord {
  return {
    id: prisma.id,
    poNumber: prisma.po_number,
    trackingNumber: prisma.tracking_number,
    // ... explicit mapping
  }
}

// Domain → Prisma
export function recordToPrismaData(record: Omit<ShipmentRecord, 'createdAt'>) {
  return {
    po_number: record.poNumber,
    tracking_number: record.trackingNumber,
    // ... explicit mapping
  }
}
```

### 3. Use in Repository

```typescript
import { prismaShipmentToRecord, recordToPrismaData } from './mappers'

export const createRepository = () => ({
  async findById(id: number) {
    const record = await prisma.shipments.findUnique({ where: { id } })
    return record ? Entity.fromDatabase(prismaShipmentToRecord(record)) : null
  },

  async save(entity: Entity) {
    const persistenceData = Entity.toPersistence(entity)
    const prismaData = recordToPrismaData(persistenceData)
    
    const record = await prisma.shipments.upsert({
      where: { tracking_number: persistenceData.trackingNumber },
      update: prismaData,
      create: prismaData,
    })
    
    return Entity.fromDatabase(prismaShipmentToRecord(record))
  }
})
```

## Benefits

✅ **Type-safe** - Compiler catches field mismatches  
✅ **No `any` casts** - Full type inference  
✅ **Scalable** - Easy template for new repositories  
✅ **Maintainable** - Schema changes caught at compile time  

## Example

See `PrismaShipmentRepository.ts` for complete implementation.

## Extending

For new entities:
1. Add types to `types.ts`
2. Create mapper functions in `mappers.ts`
3. Use mappers in repository (no `any` casts)
