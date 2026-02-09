# Structured Logging

Type-safe structured logging for Next.js with OpenTelemetry compatibility.

## Features

✅ Universal API (works on client and server)  
✅ Auto-detects environment  
✅ Type-safe with full TypeScript support  
✅ JSON-formatted for Vercel  
✅ Context propagation (request IDs, user IDs)  
✅ Performance tracking  
✅ Auto-redacts sensitive fields  

## Quick Start

### Basic Usage

```typescript
import { getLogger } from '@/lib/infrastructure/logging'

const logger = getLogger()

logger.info('User logged in', { userId: '123' })
logger.error('Operation failed', { error: new Error('...'), context: {...} })
```

### API Route

```typescript
import { withLogging } from '@/lib/infrastructure/logging/middleware'

export const GET = withLogging(async (request, { logger }) => {
  logger.info('Processing request')
  // Your logic
  return NextResponse.json({ data })
})
```

### Use Case / Service

```typescript
import { createLogger, logPerformance } from '@/lib/infrastructure/logging'

export class RegisterTrackerUseCase {
  private logger = createLogger({ useCase: 'RegisterTracker' })

  async execute(params) {
    const endLog = logPerformance(this.logger, 'registerTracker')
    
    try {
      this.logger.info('Starting', params)
      // Your logic
      return result
    } catch (error) {
      this.logger.error('Failed', { error })
      throw error
    } finally {
      endLog()  // Logs duration
    }
  }
}
```

### Client Component

```typescript
'use client'

import { getLogger } from '@/lib/infrastructure/logging'

export function Component() {
  const logger = getLogger()
  
  const handleAction = async () => {
    logger.info('User action')
    // Your logic
  }
}
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| `trace` | Very detailed debugging |
| `debug` | Detailed debugging |
| `info` | General information (default) |
| `warn` | Warning conditions |
| `error` | Error conditions |
| `fatal` | Critical failures |

## Configuration

```bash
# .env.local
LOG_LEVEL=info           # Set minimum level
SERVICE_NAME=tracking-dashboard
```

## Context & Performance

### Child Logger

```typescript
const userLogger = logger.child({ userId: '123', role: 'admin' })
userLogger.info('Action')  // Includes userId and role automatically
```

### Performance Tracking

```typescript
import { logPerformance } from '@/lib/infrastructure/logging'

const endLog = logPerformance(logger, 'databaseQuery')
await db.query(...)
endLog()  // Logs: "Completed: databaseQuery {durationMs: 123}"
```

## Environment Behavior

- **Development:** Pretty-printed with colors
- **Production:** JSON for Vercel log aggregation

## Security

Auto-redacts: `password`, `token`, `apiKey`, `secret`, `authorization`

```typescript
logger.info('Auth', { 
  username: 'john',
  password: 'secret'  // ← Automatically redacted
})
```

## Best Practices

✅ Use appropriate log levels  
✅ Include relevant context (IDs, counts, durations)  
✅ Use child loggers for related operations  
✅ Use structured metadata, not string concatenation  

```typescript
// ✅ Good
logger.info('Payment processed', { orderId: '123', amount: 99.99 })

// ❌ Bad
logger.info(`Payment processed for order 123 amount $99.99`)
```

## Troubleshooting

**Logs not appearing in Vercel:**
- Check `LOG_LEVEL` environment variable
- Verify you're at or above the minimum level
- Check Vercel Dashboard → Logs (may take a few seconds)

**TypeScript errors:**
```typescript
// ✅ Correct
import { getLogger } from '@/lib/infrastructure/logging'

// ❌ Wrong - don't import implementations directly
import { getServerLogger } from '@/lib/infrastructure/logging/server-logger'
```

---

**Files:**
- `types.ts` - Core interfaces
- `server-logger.ts` - Pino-based server implementation
- `client-logger.ts` - Browser-compatible client implementation
- `index.ts` - Universal factory
- `middleware.ts` - Next.js API route helpers
