# Extraction SDK Usage Examples

## Current State (Too Specific)

```typescript
// ❌ Only works for tracking extraction
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'

const tracking = await extractTrackingFromEmail(messages)
```

**Problem:** What if we need to extract invoice data tomorrow? Duplicate the entire SDK!

---

## Proposed: Hybrid Extraction SDK

### Example 1: Tracking Extraction (Current Use Case)

```typescript
// ✅ Domain-optimized module
import { extractTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'

const result = await extractTracking({
  messages: [
    {
      subject: 'Your order has shipped',
      body: 'Tracking: 1Z999AA10123456784',
      senderEmail: 'ship@supplier.com',
    }
  ]
})

console.log(result)
// {
//   supplier: 'Acme Corp',
//   shipments: [
//     { trackingNumber: '1Z999AA10123456784', carrier: 'ups', confidence: 0.95 }
//   ]
// }
```

---

### Example 2: Invoice Extraction (Future)

```typescript
// ✅ Add new module without touching core
import { extractInvoice } from '@/lib/infrastructure/sdks/extraction/modules/finance'

const invoice = await extractInvoice({
  source: 'pdf',
  content: pdfBuffer,
})

console.log(invoice)
// {
//   invoiceNumber: 'INV-12345',
//   date: '2024-02-08',
//   total: 1234.56,
//   currency: 'USD',
//   lineItems: [
//     { description: 'Product A', quantity: 10, price: 123.45 }
//   ]
// }
```

---

### Example 3: Email Categorization (Future)

```typescript
// ✅ Communications module
import { categorizeEmail } from '@/lib/infrastructure/sdks/extraction/modules/communications'

const category = await categorizeEmail({
  subject: 'URGENT: Need rush order',
  body: 'Can you expedite shipping?',
})

console.log(category)
// {
//   type: 'rush_order_request',
//   urgency: 'high',
//   requiresAction: true,
//   suggestedResponse: 'Contact customer within 1 hour'
// }
```

---

### Example 4: Custom One-Off Extraction

```typescript
// ✅ Generic core for edge cases
import { createExtractor } from '@/lib/infrastructure/sdks/extraction'
import { z } from 'zod'

const extractor = createExtractor()

const result = await extractor.extract({
  input: emailBody,
  schema: z.object({
    customerName: z.string(),
    phoneNumber: z.string().optional(),
    preferredContactTime: z.string().optional(),
  }),
  instructions: "Extract customer contact preferences from this email"
})

console.log(result)
// {
//   customerName: 'John Doe',
//   phoneNumber: '+1-555-0123',
//   preferredContactTime: 'afternoons'
// }
```

---

### Example 5: Batch Processing

```typescript
// ✅ Process multiple extractions in parallel
import { extractTracking, extractInvoice } from '@/lib/infrastructure/sdks/extraction'

const [tracking, invoice] = await Promise.all([
  extractTracking({ messages: shipmentEmails }),
  extractInvoice({ source: 'pdf', content: invoicePdf }),
])

// Use both results together
const order = {
  tracking: tracking.shipments[0].trackingNumber,
  invoiceNumber: invoice.invoiceNumber,
  total: invoice.total,
}
```

---

### Example 6: Streaming Extraction (Future)

```typescript
// ✅ Real-time extraction with progress updates
import { streamTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'

for await (const partial of streamTracking({ messages })) {
  console.log('Extracting...', partial)
  // { supplier: 'Acme Corp', shipments: [] }          (step 1)
  // { supplier: 'Acme Corp', shipments: [partial] }   (step 2)
  // { supplier: 'Acme Corp', shipments: [complete] }  (step 3)
}
```

---

### Example 7: Multi-Provider Fallback

```typescript
// ✅ Try multiple AI models automatically
import { extractTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'

const result = await extractTracking({
  messages,
  fallbackChain: [
    'gpt-4o-mini',              // Try fast/cheap first
    'claude-3-5-sonnet',        // Fallback to Claude if GPT fails
    'gpt-4o'                    // Last resort: slower but more reliable
  ]
})
```

---

### Example 8: Confidence Thresholds

```typescript
// ✅ Only return high-confidence extractions
import { extractTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'

const result = await extractTracking({
  messages,
  minConfidence: 0.8,  // Only return if >80% confident
})

if (result.shipments.length === 0) {
  // Flag for manual review
  await flagForManualReview(messages)
}
```

---

## API Design Comparison

### Option 1: Domain-Specific (Current)

```typescript
// ❌ Need separate SDK for each domain
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'
import { extractInvoiceFromPDF } from '@/lib/application/use-cases/extractInvoiceFromPDF'
import { categorizeSupportEmail } from '@/lib/application/use-cases/categorizeSupportEmail'

// Each has different API, different patterns, duplicated code
```

### Option 2: Generic Only

```typescript
// ⚠️ Too generic, loses domain optimization
import { extract } from '@/lib/infrastructure/sdks/ai-extraction'

const tracking = await extract({
  input: emailText,
  schema: TrackingSchema,
  instructions: "Extract tracking numbers..."  // Manual prompt engineering
})

// Flexible but error-prone, no optimizations
```

### Option 3: Hybrid (Recommended)

```typescript
// ✅ Best of both worlds
import { extraction } from '@/lib/infrastructure/sdks/extraction'

// Domain-optimized for common tasks
const tracking = await extraction.shipping.tracking(messages)
const invoice = await extraction.finance.invoice(pdfBuffer)

// Generic for edge cases
const custom = await extraction.extract({
  input: text,
  schema: MySchema,
  instructions: "..."
})
```

---

## Module Organization

```
extraction/
├── core/
│   ├── extraction-client.ts       # Generic wrapper
│   ├── prompt-builder.ts          # Auto-generate prompts
│   └── types.ts
│
├── modules/
│   ├── shipping/
│   │   ├── tracking.ts            # extractTracking()
│   │   ├── label.ts               # extractLabel() - OCR + AI
│   │   └── carrier-detection.ts  # detectCarrier()
│   │
│   ├── finance/
│   │   ├── invoice.ts             # extractInvoice()
│   │   ├── po.ts                  # extractPO()
│   │   └── quote.ts               # extractQuote()
│   │
│   ├── communications/
│   │   ├── categorization.ts     # categorizeEmail()
│   │   ├── sentiment.ts          # analyzeSentiment()
│   │   ├── summary.ts            # summarizeThread()
│   │   └── priority.ts           # calculatePriority()
│   │
│   └── products/
│       ├── feedback.ts            # extractFeedback()
│       └── mentions.ts            # findMentions()
│
└── index.ts                        # Public API
```

---

## Benefits Summary

### For Developers
✅ **Consistent API** across all extractions  
✅ **Easy to add** new extraction types  
✅ **Type-safe** with Zod validation  
✅ **Testable** with clear boundaries  
✅ **Documented** with examples  

### For Business
✅ **Faster feature development** (reuse core)  
✅ **Lower maintenance cost** (centralized logic)  
✅ **Better quality** (optimized prompts)  
✅ **Flexible** (handle edge cases)  
✅ **Scalable** (add modules as needed)  

### For AI
✅ **Provider-agnostic** (OpenAI, Claude, etc.)  
✅ **Fallback chains** (reliability)  
✅ **Streaming support** (UX)  
✅ **Confidence scoring** (quality)  
✅ **Structured outputs** (type safety)  

---

## Migration Path

**Phase 1: Extract Core** (Week 1)
```typescript
// Create generic extraction client
const core = createExtractionCore()
```

**Phase 2: Migrate Tracking** (Week 1)
```typescript
// Move to modules/shipping/tracking.ts
export const extractTracking = (input) => core.extract({...})
```

**Phase 3: Add New Modules** (As Needed)
```typescript
// Add invoice extraction
export const extractInvoice = (input) => core.extract({...})
```

**Phase 4: Optimize** (Ongoing)
```typescript
// Fine-tune prompts per module
// Add caching, retry logic, etc.
```

---

## Decision Matrix

| Use Case | Current Approach | Hybrid Approach | Time Saved |
|----------|------------------|-----------------|------------|
| **Tracking extraction** | ✅ Works | ✅ Same | 0 hours |
| **Invoice extraction** | ❌ Build from scratch | ✅ 2 hours | **8 hours** |
| **Email categorization** | ❌ Build from scratch | ✅ 1 hour | **6 hours** |
| **PO extraction** | ❌ Build from scratch | ✅ 1 hour | **4 hours** |
| **Custom one-off** | ❌ Hard to do | ✅ 30 min | **2 hours** |

**Total time saved over 6 months:** ~20 hours of development time

---

## Recommendation

**Implement the Hybrid Extraction SDK** because:

1. ✅ **No regression** - tracking extraction works exactly the same
2. ✅ **Future-proof** - easy to add new extractions
3. ✅ **Better architecture** - clean separation of generic vs domain-specific
4. ✅ **Minimal refactor** - mostly moving files, not rewriting logic
5. ✅ **High ROI** - saves significant time on future features

**Start with:**
1. Extract core extraction logic (2 hours)
2. Move tracking to `modules/shipping/` (30 min)
3. Add invoice extraction as proof-of-concept (1 hour)
4. Document and deploy (30 min)

**Total effort:** ~4 hours for a foundation that saves 20+ hours over time.
