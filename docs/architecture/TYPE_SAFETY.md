# Type Safety Architecture

## Overview

This document describes the architectural patterns for type-safe API consumption throughout the codebase.

## Core Principles

1. **No `any` types** - Ever. Use proper types or `unknown` with type guards
2. **Runtime validation** - Validate external API responses with Zod
3. **Type inference** - Derive TypeScript types from Zod schemas
4. **Consistent patterns** - Same approach across all SDKs and components

## Architecture Layers

### 1. Base SDK Client (`lib/infrastructure/sdks/base-client.ts`)

All external API clients extend `BaseSdkClient`:

```typescript
export abstract class BaseSdkClient {
  protected async request<T>(
    endpoint: string,
    options: RequestInit,
    schema?: z.ZodType<T>  // Optional runtime validation
  ): Promise<T>
}
```

**Benefits:**
- Consistent error handling
- Automatic request/response logging
- Built-in validation
- Type-safe responses

### 2. SDK Schemas (`lib/infrastructure/sdks/*/schemas.ts`)

Each SDK defines Zod schemas for API responses:

```typescript
// Define schema
export const FrontMessageSchema = z.object({
  id: z.string(),
  body: z.string(),
  // ... all fields
})

// Derive TypeScript type
export type FrontMessage = z.infer<typeof FrontMessageSchema>
```

**Benefits:**
- Single source of truth
- Runtime validation
- TypeScript type safety
- Self-documenting

### 3. SDK Clients (`lib/infrastructure/sdks/*/client.ts`)

SDK clients use base client + schemas:

```typescript
export class FrontClient extends BaseSdkClient {
  async getMessages(id: string): Promise<FrontMessage[]> {
    return this.get(
      `/conversations/${id}/messages`,
      FrontListResponseSchema(FrontMessageSchema)  // Validates response
    )
  }
}
```

### 4. Internal API Schemas (`lib/types/api-schemas.ts`)

Define schemas for all internal API endpoints:

```typescript
export const ScanResultSchema = z.object({
  success: z.boolean(),
  summary: SyncSummarySchema,
  errors: z.array(z.string()).optional(),
})

export type ScanResult = z.infer<typeof ScanResultSchema>
```

### 5. Component Hooks (`lib/hooks/use-api.ts`)

Type-safe hooks for components:

```typescript
// In component
import { useApi } from '@/lib/hooks/use-api'
import { ScanResultSchema } from '@/lib/types/api-schemas'

const { state, execute } = useApi(ScanResultSchema)

// Type-safe!
const handleSync = async () => {
  const result = await execute('/api/front/scan', { method: 'POST' })
  // result is typed as ScanResult
}
```

### 6. Utility Helpers (`lib/utils/fetch-helpers.ts`)

Centralized fetch utilities:

```typescript
// Type-safe fetch with validation
export async function fetchJson<T>(
  url: string,
  options: RequestInit,
  schema?: z.ZodType<T>
): Promise<T>

// Error message extraction
export function getErrorMessage(error: unknown): string
```

## Usage Patterns

### Pattern 1: External API Client

```typescript
// 1. Define schema
export const ApiResponseSchema = z.object({
  data: z.string(),
})

// 2. Create client
export class ApiClient extends BaseSdkClient {
  async getData(): Promise<ApiResponse> {
    return this.get('/data', ApiResponseSchema)
  }
}

// 3. Use in route
const client = new ApiClient(apiKey)
const data = await client.getData()  // Fully typed!
```

### Pattern 2: Internal API Endpoint

```typescript
// 1. Define response schema
export const MyApiResponseSchema = z.object({
  result: z.string(),
})

// 2. Use in API route
export async function GET() {
  const result = { result: 'success' }
  // Response matches schema
  return NextResponse.json(result)
}

// 3. Consume in component
const { execute } = useApi(MyApiResponseSchema)
const data = await execute('/api/my-endpoint')
// data is typed!
```

### Pattern 3: Error Handling

```typescript
// Never use catch (error: any)
try {
  await someOperation()
} catch (error: unknown) {
  // Use type guard
  const message = getErrorMessage(error)
  logger.error('Operation failed', { error: message })
}
```

### Pattern 4: Unknown Data

```typescript
// Never cast to any
const data: unknown = await response.json()

// Use type guard or schema
if (isErrorResponse(data)) {
  throw new Error(data.error)
}

// Or validate
const result = MySchema.parse(data)
```

## Migration Guide

### Migrating a Component

**Before:**
```typescript
const handleSync = async () => {
  const response = await fetch('/api/sync')
  const data: any = await response.json()  // ❌
  if (data.error) {
    // No type safety
  }
}
```

**After:**
```typescript
import { useMutation } from '@/lib/hooks/use-api'
import { ScanResultSchema } from '@/lib/types/api-schemas'

const { mutate } = useMutation('/api/sync', ScanResultSchema)

const handleSync = async () => {
  try {
    const result = await mutate({})  // ✅ Fully typed
    // result.summary.shipmentsAdded is typed
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}
```

### Migrating an SDK Client

**Before:**
```typescript
async getData(id: string) {
  const response = await fetch(`${baseUrl}/data/${id}`)
  return response.json() as any  // ❌
}
```

**After:**
```typescript
// 1. Define schema
const DataSchema = z.object({
  id: z.string(),
  value: z.number(),
})

// 2. Use base client
class MyClient extends BaseSdkClient {
  async getData(id: string) {
    return this.get(`/data/${id}`, DataSchema)  // ✅
  }
}
```

## Benefits

### Type Safety
- Compile-time type checking
- IDE autocomplete
- Refactoring confidence

### Runtime Safety
- Validate external data
- Catch API contract changes
- Fail fast with clear errors

### Maintainability
- Single source of truth (schemas)
- Consistent patterns
- Self-documenting code

### Developer Experience
- Clear error messages
- Type-safe hooks
- Reusable utilities

## Checklist

When adding new API integrations:

- [ ] Define Zod schema for response
- [ ] Derive TypeScript type from schema
- [ ] Use `BaseSdkClient` for external APIs
- [ ] Use `useApi` or `useMutation` in components
- [ ] Use `getErrorMessage` for error handling
- [ ] Never use `any` type
- [ ] Validate unknown data

## Examples

See:
- `lib/infrastructure/sdks/front/client.ts` - External API client
- `lib/infrastructure/sdks/ship24/client.ts` - Another external client
- `lib/hooks/use-api.ts` - Component hooks
- `components/SyncDialog.tsx` - Component using hooks (after migration)

---

**Last Updated:** 2026-02-09
