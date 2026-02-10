# API Pagination, Filtering & Sorting

## Overview

The shipment list endpoint (`/api/orpc/shipments.list`) supports server-side pagination, filtering, and sorting using a standardized oRPC schema.

## Endpoint

**POST** `/api/orpc/shipments.list`

## Request Schema

```typescript
{
  pagination?: {
    page: number        // Default: 1, Min: 1
    pageSize: number    // Default: 20, Max: 100
  },
  filter?: {
    search?: string     // Search across tracking #, PO #, and supplier (case-insensitive)
    status?: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'failed_attempt'
    carrier?: string    // Partial match, case-insensitive
  },
  sort?: {
    field: 'trackingNumber' | 'poNumber' | 'supplier' | 'status' | 'shippedDate' | 'estimatedDelivery' | 'deliveredDate' | 'createdAt'
    direction: 'asc' | 'desc'
  }
}
```

## Response Schema

```typescript
{
  items: Shipment[],
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

### Shipment Object

```typescript
{
  id: number
  trackingNumber: string
  carrier: string | null
  status: string
  poNumber: string | null
  supplier: string | null
  shippedDate: string | null        // ISO 8601
  estimatedDelivery: string | null  // ISO 8601
  deliveredDate: string | null      // ISO 8601
  ship24Status: string | null
  ship24LastUpdate: string | null   // ISO 8601
  lastChecked: string | null        // ISO 8601
  lastError: string | null
  createdAt: string                 // ISO 8601
  updatedAt: string                 // ISO 8601
  trackingEvents?: TrackingEvent[]
}
```

## Examples

### 1. Basic Pagination

```typescript
// Page 1, 20 items
const response = await client.shipments.list({
  pagination: { page: 1, pageSize: 20 }
})
```

### 2. Unified Search

Search across tracking number, PO number, and supplier simultaneously:

```typescript
// Find any shipment matching "12345" in tracking, PO, or supplier
const response = await client.shipments.list({
  filter: { search: "12345" }
})

// Examples:
// - Tracking: "1Z12345678"
// - PO: "PO-12345"
// - Supplier: "Acme Corp 12345"
```

### 3. Status Filter

```typescript
// Get only delivered shipments
const response = await client.shipments.list({
  filter: { status: 'delivered' }
})
```

### 4. Combined Search + Status

```typescript
// Search for "ABC Corp" shipments that are in transit
const response = await client.shipments.list({
  filter: {
    search: "ABC Corp",
    status: 'in_transit'
  }
})
```

### 5. Sort by Shipped Date

```typescript
// Get shipments sorted by shipped date (newest first)
const response = await client.shipments.list({
  sort: { field: 'shippedDate', direction: 'desc' }
})
```

### 6. Full Query

```typescript
const response = await client.shipments.list({
  pagination: { page: 2, pageSize: 50 },
  filter: {
    search: "Nike",
    status: 'in_transit'
  },
  sort: { field: 'shippedDate', direction: 'desc' }
})
```

## Filter Behavior

### Unified Search (`search` parameter)
- **Case-insensitive** partial match
- Searches across **3 fields simultaneously** (OR logic):
  - `tracking_number`
  - `po_number`
  - `supplier`
- Example: `search: "1234"` finds:
  - Tracking: "1ZW1234567"
  - PO: "PO-1234"
  - Supplier: "Supplier 1234"

### Status Filter
- **Exact match** on status enum
- Options: `pending`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `failed_attempt`

### Combining Filters
- All filters are combined with **AND logic**
- Example: `search: "Nike"` + `status: "delivered"` = delivered shipments containing "Nike"

## Sorting

### Available Sort Fields
- `trackingNumber` - Alphabetical
- `poNumber` - Alphabetical
- `supplier` - Alphabetical
- `status` - Alphabetical (delivered → exception → in_transit → out_for_delivery → pending)
- `shippedDate` - Chronological
- `estimatedDelivery` - Chronological
- `deliveredDate` - Chronological
- `createdAt` - Chronological (default)

### Sort Behavior
- `NULL` values are sorted last for ascending, first for descending
- Default sort: `createdAt DESC` (newest first)

## Performance Notes

- **Database indexes** exist on: `tracking_number`, `po_number`, `status`, `shipped_date`, `estimated_delivery`, `delivered_date`
- **Query debouncing**: Frontend debounces filter changes by 300ms
- **Max page size**: 100 items per page (enforced by schema)

## Frontend Integration

```typescript
import { createORPCClient } from '@/lib/orpc/client'

const client = createORPCClient()

// React state management
const [query, setQuery] = useState({
  pagination: { page: 1, pageSize: 20 },
  filter: { search: '' },
  sort: undefined
})

// Fetch with query
const { data, isLoading } = useQuery({
  queryKey: ['shipments', query],
  queryFn: () => client.shipments.list(query)
})

// Update search (with debouncing)
useEffect(() => {
  const timer = setTimeout(() => {
    setQuery(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: 1 }, // Reset to page 1
      filter: { search: searchInput }
    }))
  }, 300)
  
  return () => clearTimeout(timer)
}, [searchInput])
```

## Migration from Old Filters

**Before (separate filters):**
```typescript
filter: {
  trackingNumber: "12345",
  poNumber: "PO-6789",
  supplier: "Nike"
}
```

**After (unified search):**
```typescript
filter: {
  search: "12345"  // Searches all three fields
}
```

The old individual filters (`trackingNumber`, `poNumber`, `supplier`) are still supported for backwards compatibility but will apply **AND** logic instead of **OR**.
