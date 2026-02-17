# Migration Plan: Decoupling Order Sync from Shipments

## Problem Statement

**Current State:**
- Orders only appear if they have a shipped PO with tracking
- Flow: `Shipment (has PO) → Sync PO from OMG → Derive orders from POs`
- Orders without shipments are invisible

**Desired State:**
- Orders are synced directly from OMG (source of truth)
- Orders appear even if no shipments exist yet
- Shipments are matched to POs after the fact
- Orphan shipments (no matching PO) remain visible in shipment dashboard

---

## Data Model Changes

### Current Schema
```
orders ←── omg_purchase_orders ←── shipments
  │              │                    │
  │              └── shipment_id (FK) │
  │                                   │
  └── derived from grouped POs        └── standalone, linked by po_number
```

### New Schema
```
orders ─────────────────┬──── purchase_orders (new table)
  │                     │           │
  │ (1:N)               │           │ (1:N via po_number match)
  │                     │           │
  └── order_number (PK) └── order_number (FK)
                                    │
                        shipments ──┘
                           │
                           └── po_number (nullable, for matching)
```

### Schema Changes

#### 1. New `purchase_orders` table (replaces `omg_purchase_orders`)
```prisma
model purchase_orders {
  id              Int      @id @default(autoincrement())
  po_number       String   @unique @db.VarChar(50)  // e.g., "164-1"
  order_number    String   @db.VarChar(50)          // FK to orders
  
  // OMG identifiers
  omg_po_id       String   @db.VarChar(50)
  omg_order_id    String   @db.VarChar(50)
  
  // Supplier info
  supplier_name   String?  @db.VarChar(255)
  
  // Dates from OMG
  ship_date       DateTime?
  in_hands_date   DateTime?
  
  // Operations status from OMG
  operations_status String? @db.VarChar(50)
  
  // Timestamps
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  synced_at       DateTime @default(now())
  
  // Relations
  order           orders   @relation(fields: [order_number], references: [order_number])
  
  @@index([order_number])
}
```

#### 2. Updated `orders` table
```prisma
model orders {
  // ... existing fields ...
  
  // New fields from direct OMG sync
  omg_approval_status   String?  @db.VarChar(50)  // "approved", "pending_approval", etc.
  omg_created_at        DateTime?
  omg_updated_at        DateTime?
  
  // Computed fields (still needed for filtering)
  po_count              Int      @default(0)
  
  // Relations
  purchase_orders       purchase_orders[]
}
```

#### 3. Keep `shipments` unchanged
- `po_number` remains nullable
- Matching happens via join/lookup, not FK

---

## Sync Architecture

### Current Flow
```
Ship24 Webhook → Create Shipment → Sync PO if has po_number → Create Order (derived)
```

### New Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OMG ORDER SYNC (periodic)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Fetch all orders from OMG (paginated)                               │
│  2. Filter out: pending_approval, pending_prepayment                    │
│  3. For each order:                                                     │
│     a. Upsert order record                                              │
│     b. Fetch POs for this order                                         │
│     c. Upsert each PO record                                            │
│     d. Trigger thread discovery for new orders                          │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   SHIPMENT → ORDER LINKING (on shipment update)          │
├─────────────────────────────────────────────────────────────────────────┤
│  When shipment is created/updated:                                      │
│  1. If shipment has po_number:                                          │
│     a. Normalize po_number                                              │
│     b. Look up purchase_orders table                                    │
│     c. Get order_number from PO                                         │
│     d. Recompute order stats (shipment counts, status)                  │
│  2. If no matching PO:                                                  │
│     a. Shipment remains "orphan" (visible in Shipments dashboard)       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Schema Migration
1. Create `purchase_orders` table with new structure
2. Add new fields to `orders` table
3. Migrate data from `omg_purchase_orders` to new tables
4. Update Order model types

**Files to modify:**
- `prisma/schema.prisma`
- `lib/domain/order/types.ts`

### Phase 2: OMG Sync Service
1. Create `OmgOrderSyncService` that:
   - Fetches orders directly from OMG API (with date cutoff)
   - Filters by approval status
   - Syncs orders → POs hierarchy
   - Triggers thread discovery for new orders
2. Add cron job or manual trigger for periodic sync

**Files to create/modify:**
- `lib/infrastructure/omg/OmgOrderSyncService.ts` (new)
- `lib/infrastructure/omg/client.ts` (add date filter support)

### Phase 3: Update OrderSyncService
1. Decouple from `omg_purchase_orders`
2. Compute stats from `purchase_orders` + `shipments` join
3. Handle orphan shipments gracefully

**Files to modify:**
- `lib/infrastructure/order/OrderSyncService.ts`
- `lib/infrastructure/order/OrderRepository.ts`

### Phase 4: UI Updates
1. Orders page shows all synced orders (even with 0 shipments)
2. Add "Shipment Status" filter: None / In Transit / Delivered / etc.
3. Shipments page highlights orphan shipments
4. Add "Link to OMG" action for orphan shipments

**Files to modify:**
- `components/OrdersTable.tsx`
- `components/ShipmentTable.tsx`
- `lib/orpc/router.ts`

### Phase 5: Cleanup
1. Remove `omg_purchase_orders` table
2. Remove old sync code
3. Update documentation

---

## API Changes

### New Endpoints

```typescript
// Trigger full OMG sync
orders.syncFromOmg({ 
  since?: Date,      // Only orders updated after this date
  fullResync?: boolean 
})

// Get orphan shipments (no matching PO)
shipments.listOrphans({
  limit?: number,
  offset?: number,
})

// Manually link shipment to PO
shipments.linkToPo({
  shipmentId: number,
  poNumber: string,
})
```

### Updated Endpoints

```typescript
// orders.list - add new filters
orders.list({
  status?: OrderStatus,
  hasShipments?: boolean,  // NEW: filter by presence of shipments
  search?: string,
})
```

---

## Approval Status Filtering

From OMG API, `order.status.approval.value` can be:
- `"approved"` ✓ Include
- `"pending_approval"` ✗ Exclude
- `"pending_prepayment"` ✗ Exclude
- `"rejected"` ✗ Exclude
- Other values → Include (log for investigation)

---

## Migration Script

```typescript
// scripts/migrate-to-order-sync.ts

async function migrate() {
  // 1. Create new tables (via Prisma migration)
  
  // 2. Copy data from omg_purchase_orders → purchase_orders + orders
  const omgRecords = await prisma.omg_purchase_orders.findMany()
  
  for (const record of omgRecords) {
    // Upsert order
    await prisma.orders.upsert({
      where: { order_number: record.order_number },
      create: { /* ... */ },
      update: { /* ... */ },
    })
    
    // Create PO
    await prisma.purchase_orders.create({
      data: {
        po_number: record.po_number,
        order_number: record.order_number,
        omg_po_id: record.omg_po_id,
        omg_order_id: record.omg_order_id,
        // ...
      }
    })
  }
  
  // 3. Run initial OMG sync to catch missing orders
  await omgOrderSyncService.syncAll()
  
  // 4. Recompute all order stats
  await orderSyncService.recomputeAllStats()
}
```

---

## Rollback Plan

1. Keep `omg_purchase_orders` table intact during migration
2. Add feature flag `USE_NEW_ORDER_SYNC=true`
3. If issues arise, disable flag → falls back to old behavior
4. Once stable, drop old table and flag

---

## Testing Checklist

- [ ] New orders appear even with 0 shipments
- [ ] Pending approval orders are excluded
- [ ] Existing shipments correctly link to orders
- [ ] Orphan shipments display in shipment table
- [ ] Thread discovery triggers for new orders
- [ ] Order stats update when shipments change
- [ ] No duplicate orders after re-sync
- [ ] Performance acceptable for full sync (~500 orders)

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Schema | 1-2 hours | None |
| Phase 2: OMG Sync | 2-3 hours | Phase 1 |
| Phase 3: OrderSync | 1-2 hours | Phase 2 |
| Phase 4: UI | 2-3 hours | Phase 3 |
| Phase 5: Cleanup | 1 hour | Phase 4 + testing |

**Total: ~8-11 hours**

---

## Questions to Resolve

1. **Date cutoff for initial sync?** (e.g., orders from last 6 months)
2. **Sync frequency?** (every 15 min? hourly? manual only?)
3. **Should we show order "operations status" from OMG?** (In Production, Shipped, etc.)
4. **Do we need order-level dates?** (created, approved, etc.)
