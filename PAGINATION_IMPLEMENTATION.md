# Server-Side Pagination & Filtering Implementation

## ✅ What Was Implemented

We've moved all filtering, sorting, and pagination to the server side using oRPC with a standardized schema.

### 1. Standard Schemas (`lib/orpc/schemas.ts`)

Created reusable schemas for all list endpoints:

- **PaginationInputSchema** - Standard pagination (page, pageSize)
- **SortInputSchema** - Standard sorting (field, direction)
- **ShipmentFilterSchema** - Shipment-specific filters
- **ShipmentSortSchema** - Shipment-specific sortable fields
- **ShipmentListQuerySchema** - Complete query schema
- **createPaginatedResponseSchema** - Standard response wrapper

### 2. Backend Updates (`lib/orpc/router.ts`)

Updated `shipments.list` endpoint to:

- Accept pagination, filter, and sort parameters
- Build Prisma queries using helper functions
- Return paginated response with metadata
- Include tracking events (latest 5 per shipment)

### 3. Frontend Updates

**`app/page.tsx`**:
- Uses oRPC client for API calls
- Manages query state
- Passes data to ShipmentTable

**`components/ShipmentTable.tsx`**:
- Accepts pagination data and query change callback
- Debounces filter inputs (300ms)
- Sends server-side queries on filter/sort/page changes
- Shows loading state during requests
- Displays pagination controls (Previous/Next)

## 📊 Features

### Filtering
- **Tracking Number** - Partial match, case-insensitive
- **PO Number** - Partial match, case-insensitive
- **Supplier** - Partial match, case-insensitive
- **Status** - Exact match dropdown
- **Debounced** - 300ms delay before sending request

### Sorting
- **Shipped Date**
- **Estimated Delivery Date**
- Click column header to cycle: none → asc → desc → none

### Pagination
- **Page size**: 20 items (configurable)
- **Max page size**: 100 items
- **Navigation**: Previous/Next buttons
- **Status**: "Showing X to Y of Z shipments"

### Performance
- **Database-level filtering** - Only matching rows returned
- **Indexed columns** - Fast queries on tracking_number, po_number, status
- **Debounced inputs** - Reduces API calls
- **Optimistic UI** - Shows loading state, doesn't clear data

## 🔧 Usage Examples

### Basic Query (First Page)
```typescript
await api.shipments.list({
  pagination: { page: 1, pageSize: 20 }
})
```

### Filter by Tracking Number
```typescript
await api.shipments.list({
  pagination: { page: 1, pageSize: 20 },
  filter: { trackingNumber: '1Z' }
})
```

### Sort by Shipped Date
```typescript
await api.shipments.list({
  pagination: { page: 1, pageSize: 20 },
  sort: { field: 'shippedDate', direction: 'desc' }
})
```

### Combined Query
```typescript
await api.shipments.list({
  pagination: { page: 2, pageSize: 50 },
  filter: {
    status: 'delivered',
    supplier: 'Acme'
  },
  sort: { field: 'deliveredDate', direction: 'desc' }
})
```

## 📁 Files Created/Modified

### New Files
- `lib/orpc/schemas.ts` - Standard pagination/filter schemas
- `docs/API-PAGINATION-FILTERING.md` - API documentation

### Modified Files
- `lib/orpc/router.ts` - Updated shipments.list endpoint
- `app/page.tsx` - Server-side data fetching
- `components/ShipmentTable.tsx` - Server-side filtering/pagination
- `lib/infrastructure/mappers/Ship24Mapper.ts` - Fixed TypeScript errors

## 🚀 Next Steps

To add pagination to other endpoints:

1. Define filter/sort schemas in `lib/orpc/schemas.ts`
2. Create helper functions (`buildWhereClause`, `buildOrderByClause`)
3. Update router endpoint to use schemas
4. Update frontend component to use `onQueryChange` pattern

See `docs/API-PAGINATION-FILTERING.md` for complete guide.

## 🧪 Testing

Test the implementation:

1. **Start dev server**: `npm run dev`
2. **Filter by tracking**: Type in "Tracking Number" filter
3. **Sort dates**: Click "Shipped" or "Est. Delivery" headers
4. **Paginate**: Click Previous/Next buttons
5. **Combine**: Use multiple filters + sorting + pagination

All operations should update the URL-like state and fetch fresh data from the server.
