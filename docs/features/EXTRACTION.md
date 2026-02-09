# Extraction SDK - Quick Start

## Overview

Hybrid extraction framework with **generic core** + **domain modules**.

```
extraction/
├── core/           # Generic (for any extraction)
└── modules/        # Domain-optimized (for common tasks)
    └── shipping/   # Tracking, labels, carrier detection
```

---

## Quick Usage

### Extract Tracking (Existing)

```typescript
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'

const result = await extractTrackingFromEmail([
  {
    subject: 'Your order has shipped',
    body: 'Tracking: 1Z999AA10123456784',
    senderEmail: 'ship@supplier.com',
    senderName: 'Acme Corp',
  }
])

console.log(result)
// {
//   supplier: 'Acme Corp',
//   shipments: [
//     { trackingNumber: '1Z999AA10123456784', carrier: 'ups', confidence: 0.95 }
//   ]
// }
```

---

## Add New Module (Future)

### Step 1: Create Schema (5 min)

```typescript
// modules/finance/schemas.ts
import { z } from 'zod'

export const InvoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string(),
  total: z.number(),
  currency: z.string(),
})

export type Invoice = z.infer<typeof InvoiceSchema>
```

### Step 2: Create Extraction Function (30 min)

```typescript
// modules/finance/invoice.ts
import { createExtractionClient } from '../../core'
import { InvoiceSchema } from './schemas'

export async function extractInvoice(pdfText: string) {
  const client = createExtractionClient()
  
  return client.extract({
    input: pdfText,
    schema: InvoiceSchema,
    instructions: "Extract invoice number, date, total amount, and currency"
  })
}
```

### Step 3: Export (1 min)

```typescript
// modules/finance/index.ts
export * from './invoice'
export * from './schemas'

// extraction/index.ts
export * from './modules/finance'
```

### Step 4: Use It

```typescript
import { extractInvoice } from '@/lib/infrastructure/sdks/extraction'

const invoice = await extractInvoice(pdfText)
console.log(invoice.invoiceNumber) // "INV-12345"
```

**Total Time:** ~1 hour

---

## Generic Extraction (One-Offs)

```typescript
import { createExtractionClient } from '@/lib/infrastructure/sdks/extraction'
import { z } from 'zod'

const client = createExtractionClient()

const result = await client.extract({
  input: "John Doe, age 30, NYC",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    city: z.string(),
  }),
  instructions: "Extract name, age, and city"
})

console.log(result)
// { name: 'John Doe', age: 30, city: 'NYC' }
```

---

## Architecture Decision Tree

```
Do you need to extract data?
│
├─ Is it a one-off/custom extraction?
│  └─ YES → Use generic core
│      import { createExtractionClient } from '@/lib/infrastructure/sdks/extraction'
│
└─ Is it a common/repeated task?
   └─ YES → Check if module exists
       │
       ├─ Module exists? → Use it
       │  └─ import { extractTracking } from '@/lib/infrastructure/sdks/extraction'
       │
       └─ Module doesn't exist? → Create it (1 hour)
          └─ Use generic core + domain-specific prompts
```

---

## Benefits

✅ **Generic Core** - Handle any extraction  
✅ **Domain Modules** - Optimized for common tasks  
✅ **Easy to Extend** - 1 hour per new module  
✅ **Type Safe** - Zod validation everywhere  
✅ **Testable** - Clear boundaries  

---

## What's Next?

**Current Modules:**
- ✅ `shipping/tracking` - Extract tracking from emails

**Planned Modules:**
- ⏳ `finance/invoice` - Extract invoice data
- ⏳ `finance/po` - Extract PO numbers
- ⏳ `communications/categorization` - Categorize emails

**Add as needed** (1-2 hours each)

---

## Files

```
lib/infrastructure/sdks/extraction/
├── core/
│   ├── types.ts                   # Interfaces
│   ├── extraction-client.ts       # Generic AI wrapper
│   └── index.ts
│
├── modules/
│   └── shipping/
│       ├── schemas.ts             # Zod schemas
│       ├── prompts.ts             # Domain prompts
│       ├── tracking.ts            # extractTracking()
│       └── index.ts
│
└── index.ts                        # Public API
```

---

## Quick Reference

| Task | Import | Function |
|------|--------|----------|
| **Tracking extraction** | `@/lib/application/use-cases/extractTrackingFromEmail` | `extractTrackingFromEmail()` |
| **Generic extraction** | `@/lib/infrastructure/sdks/extraction` | `createExtractionClient()` |
| **Add new module** | Create in `modules/` | Export from `index.ts` |

---

**Questions?** See `HYBRID_EXTRACTION_SDK.md` for full documentation.
