# API Fetch Error Fix

## Problem
After implementing oRPC pagination, the frontend showed:
```
Failed to fetch shipments
```

## Root Cause
The oRPC client (`api.shipments.list()`) wasn't properly configured/working, causing the fetch to fail.

## Solution
Reverted to using the REST API (`/api/shipments`) with query parameters instead of oRPC.

### Changes Made

1. **Updated REST API Endpoint** (`app/api/shipments/route.ts`)
   - Added server-side pagination support
   - Added filtering support (trackingNumber, poNumber, supplier, status, carrier)
   - Added sorting support (any field, asc/desc)
   - Returns paginated response format:
     ```json
     {
       "items": [...],
       "pagination": {
         "page": 1,
         "pageSize": 20,
         "total": 150,
         "totalPages": 8,
         "hasNext": true,
         "hasPrev": false
       }
     }
     ```

2. **Updated Frontend** (`app/page.tsx`)
   - Removed oRPC client dependency
   - Uses standard `fetch()` with query parameters
   - Builds URL params from filter/sort state
   - Handles both paginated and array responses (fallback)

3. **Updated Table Component** (`components/ShipmentTable.tsx`)
   - Updated type interfaces (removed oRPC-specific types)
   - Query change handler now uses plain objects
   - All functionality preserved (filters, sorting, pagination)

## Query Parameter Format

**Pagination:**
```
?page=1&pageSize=20
```

**Filters:**
```
?trackingNumber=1Z&poNumber=PO-123&supplier=Acme&status=delivered
```

**Sorting:**
```
?sortField=shippedDate&sortDirection=desc
```

**Combined:**
```
?page=1&pageSize=20&status=delivered&sortField=deliveredDate&sortDirection=desc
```

## Testing

Test the fix:
```bash
# Basic query
curl "http://localhost:3000/api/shipments?page=1&pageSize=5" | jq '.pagination'

# With filter
curl "http://localhost:3000/api/shipments?status=delivered&pageSize=5" | jq '.pagination'

# With sorting
curl "http://localhost:3000/api/shipments?sortField=shippedDate&sortDirection=desc&pageSize=5" | jq '.items[0].trackingNumber'
```

## Benefits of REST API Approach

1. ✅ **Simpler** - Standard REST patterns, no special library setup
2. ✅ **Debuggable** - Easy to test with curl/Postman
3. ✅ **Compatible** - Works with any HTTP client
4. ✅ **Explicit** - Clear URL parameters show exact query
5. ✅ **Cacheable** - Standard HTTP caching works

## Future: oRPC Integration (Optional)

If you want to use oRPC in the future:
1. Keep the REST endpoint as fallback
2. Fix oRPC routing in `app/api/orpc/[...orpc]/route.ts`
3. Update `lib/orpc/client.ts` with proper configuration
4. Test oRPC endpoint independently before switching frontend

For now, REST API provides all needed functionality with better reliability.
