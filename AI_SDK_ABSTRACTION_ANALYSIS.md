# AI SDK Abstraction Analysis

## Current State

```
lib/infrastructure/sdks/tracking-extraction/
├── schemas.ts              # Tracking-specific Zod schemas
├── prompts.ts              # Tracking-specific prompts
└── vercel-ai-client.ts    # Tracking-specific client
```

**Problem:** This is a one-trick pony. What happens when we need to extract:
- Invoice data from PDFs
- Customer requests from emails
- Product feedback from conversations
- PO numbers from attachments

We'd duplicate this pattern 5+ times. 🚫

---

## Option 1: **Email Intelligence SDK** 📧

**Concept:** Broad email analysis capabilities

```
lib/infrastructure/sdks/email-intelligence/
├── schemas/
│   ├── tracking-extraction.ts
│   ├── invoice-extraction.ts
│   ├── customer-request.ts
│   └── email-categorization.ts
├── prompts/
│   ├── tracking-prompts.ts
│   ├── invoice-prompts.ts
│   └── categorization-prompts.ts
└── email-intelligence-client.ts
```

**Usage:**
```typescript
const emailIntel = createEmailIntelligenceClient()

// Extract tracking
const tracking = await emailIntel.extractTracking(messages)

// Extract invoice
const invoice = await emailIntel.extractInvoice(messages)

// Categorize
const category = await emailIntel.categorize(message)

// Generate summary
const summary = await emailIntel.summarize(thread)
```

**Pros:**
✅ Focused on email domain
✅ Multiple extraction types
✅ Natural fit for Front integration
✅ Can add: categorization, sentiment, priority scoring

**Cons:**
❌ Limited to emails only (what about PDFs, web pages?)
❌ Still somewhat narrow
❌ Doesn't cover document processing

**Score:** 7/10 - Good, but still limiting

---

## Option 2: **Document Intelligence SDK** 📄

**Concept:** Extract structured data from ANY document type

```
lib/infrastructure/sdks/document-intelligence/
├── schemas/
│   ├── tracking.ts
│   ├── invoice.ts
│   ├── customer-info.ts
│   └── product-mention.ts
├── extractors/
│   ├── email-extractor.ts
│   ├── pdf-extractor.ts
│   ├── image-extractor.ts (OCR + AI)
│   └── web-extractor.ts
├── prompts/
│   └── extraction-prompts.ts
└── document-intelligence-client.ts
```

**Usage:**
```typescript
const docIntel = createDocumentIntelligenceClient()

// From email
const tracking = await docIntel.extract({
  type: 'tracking',
  source: { type: 'email', messages: [...] },
  schema: TrackingSchema
})

// From PDF
const invoice = await docIntel.extract({
  type: 'invoice',
  source: { type: 'pdf', buffer: pdfBuffer },
  schema: InvoiceSchema
})

// From image
const label = await docIntel.extract({
  type: 'shipping-label',
  source: { type: 'image', url: imageUrl },
  schema: ShippingLabelSchema
})
```

**Pros:**
✅ Works with ANY document type
✅ Unified interface
✅ OCR + AI for images
✅ PDF parsing built-in
✅ Web scraping + extraction
✅ Highly reusable

**Cons:**
❌ Broader scope = more complexity
❌ Need to implement multiple extractors
❌ May be overkill for current needs

**Score:** 8/10 - Powerful, but ambitious

---

## Option 3: **AI Extraction SDK** (Generic) 🤖

**Concept:** Generic "schema in, data out" - let AI figure it out

```
lib/infrastructure/sdks/ai-extraction/
├── schemas.ts              # Generic types
├── extraction-client.ts    # Model-agnostic client
└── prompt-builder.ts       # Auto-generate prompts from schema
```

**Usage:**
```typescript
const extractor = createAIExtractor()

// Define ANY schema, get extraction
const result = await extractor.extract({
  input: "Email content here...",
  schema: z.object({
    trackingNumbers: z.array(z.string()),
    carrier: z.enum(['ups', 'fedex', 'usps']),
    poNumber: z.string().optional(),
  }),
  instructions: "Extract shipping information"
})

// Use for anything
const customerInfo = await extractor.extract({
  input: emailContent,
  schema: CustomerInfoSchema,
  instructions: "Extract customer contact details"
})
```

**Pros:**
✅ Maximum flexibility
✅ Minimal code - schema defines everything
✅ Works for any extraction task
✅ Easy to add new extractions (just define schema)
✅ Auto-generates prompts from schema

**Cons:**
❌ Less control over prompts
❌ Generic = may not handle edge cases well
❌ No domain-specific optimization

**Score:** 7/10 - Flexible, but may sacrifice quality

---

## Option 4: **Business Intelligence SDK** (Domain-Specific) 💼

**Concept:** E-commerce/fulfillment focused intelligence layer

```
lib/infrastructure/sdks/business-intelligence/
├── order-intelligence/
│   ├── tracking-extraction.ts
│   ├── invoice-extraction.ts
│   └── po-extraction.ts
├── customer-intelligence/
│   ├── contact-extraction.ts
│   ├── request-classification.ts
│   └── sentiment-analysis.ts
├── product-intelligence/
│   ├── feedback-extraction.ts
│   └── mention-detection.ts
└── business-intelligence-client.ts
```

**Usage:**
```typescript
const bizIntel = createBusinessIntelligenceClient()

// Order intelligence
const orderInfo = await bizIntel.orders.extractFromEmail(messages)
// Returns: { tracking, po, invoice, shipDate, carrier, supplier }

// Customer intelligence
const customerRequest = await bizIntel.customers.classifyRequest(email)
// Returns: { type: 'rush_order', urgency: 'high', actionNeeded: true }

// Product intelligence
const feedback = await bizIntel.products.extractFeedback(conversations)
// Returns: { sentiment: 'positive', issues: [], mentions: [...] }
```

**Pros:**
✅ Domain-specific = optimized prompts
✅ Combines related extractions
✅ Business-focused API
✅ Handles Stitchi's specific use cases well
✅ Can add analytics/insights later

**Cons:**
❌ Stitchi-specific (less reusable for other projects)
❌ More upfront design needed
❌ May be over-engineered for current scope

**Score:** 9/10 - Best fit for Stitchi's domain

---

## Option 5: **Hybrid: "Structured Extraction SDK"** ⚡ (RECOMMENDED)

**Concept:** Generic extraction framework + domain-specific modules

```
lib/infrastructure/sdks/extraction/
├── core/
│   ├── extraction-client.ts      # Generic Vercel AI wrapper
│   ├── schema-validator.ts       # Zod validation
│   └── prompt-builder.ts         # Smart prompt generation
├── modules/
│   ├── shipping/
│   │   ├── tracking-extraction.ts
│   │   ├── label-extraction.ts
│   │   └── schemas.ts
│   ├── finance/
│   │   ├── invoice-extraction.ts
│   │   ├── po-extraction.ts
│   │   └── schemas.ts
│   └── communications/
│       ├── email-categorization.ts
│       ├── sentiment-analysis.ts
│       └── schemas.ts
└── index.ts
```

**Usage:**
```typescript
// Generic extraction (for one-offs)
const extractor = createExtractor()
const data = await extractor.extract({
  input: text,
  schema: MySchema,
  instructions: "..."
})

// Domain-specific (optimized)
import { extractTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'
const tracking = await extractTracking(messages)

// Easy to add new modules
import { extractInvoice } from '@/lib/infrastructure/sdks/extraction/modules/finance'
const invoice = await extractInvoice(pdfText)
```

**Pros:**
✅ Best of both worlds
✅ Generic core for flexibility
✅ Domain modules for optimization
✅ Easy to add new extractions
✅ Scales with project needs
✅ Core is reusable across projects
✅ Modules are Stitchi-specific

**Cons:**
❌ Slightly more structure upfront

**Score:** 10/10 - Perfect balance

---

## Recommended Architecture

### **Option 5: Structured Extraction SDK (Hybrid)**

```
lib/infrastructure/sdks/extraction/
│
├── core/                           # Generic extraction engine
│   ├── extraction-client.ts       # Wraps Vercel AI SDK
│   ├── types.ts                   # Core types
│   └── prompt-builder.ts          # Auto-generate prompts
│
├── modules/                        # Domain-specific extractions
│   ├── shipping/
│   │   ├── tracking.ts            # extractTracking()
│   │   ├── label.ts               # extractShippingLabel()
│   │   └── schemas.ts             # Zod schemas
│   ├── finance/
│   │   ├── invoice.ts
│   │   ├── po.ts
│   │   └── schemas.ts
│   └── communications/
│       ├── categorization.ts
│       └── schemas.ts
│
└── index.ts                        # Public API
```

### Migration Path

**Phase 1: Extract Core** (1-2 hours)
- Create `core/extraction-client.ts` - generic wrapper
- Move Vercel AI logic to core
- Keep existing tracking as first module

**Phase 2: Modularize** (30 min)
- Move tracking to `modules/shipping/tracking.ts`
- Clean up public API

**Phase 3: Add Modules as Needed** (incremental)
- Add `modules/finance/invoice.ts` when needed
- Add `modules/communications/categorization.ts` when needed
- Each module is isolated, easy to add

---

## Comparison Matrix

| Aspect | Email Intel | Document Intel | AI Generic | Biz Intel | **Hybrid** |
|--------|------------|----------------|------------|-----------|----------|
| **Flexibility** | Medium | High | Highest | Low | **High** |
| **Ease of Use** | Good | Medium | Excellent | Excellent | **Excellent** |
| **Domain Fit** | Good | Medium | Poor | Excellent | **Excellent** |
| **Reusability** | Medium | High | Highest | Low | **High** |
| **Scalability** | Medium | High | High | Medium | **Highest** |
| **Initial Effort** | Low | High | Low | High | **Medium** |
| **Long-term Value** | Medium | High | Medium | High | **Highest** |
| **Score** | 7/10 | 8/10 | 7/10 | 9/10 | **10/10** |

---

## Recommendation

✅ **Implement Option 5: Structured Extraction SDK (Hybrid)**

**Why:**
1. **Generic core** handles any extraction task
2. **Domain modules** provide optimized extractions for Stitchi's needs
3. **Scales incrementally** - add modules as needed
4. **Best DX** - simple for common tasks, flexible for custom ones
5. **Future-proof** - can handle emails, PDFs, images, etc.

**Next Steps:**
1. Extract generic extraction logic to `core/`
2. Move tracking to `modules/shipping/tracking.ts`
3. Clean up public API
4. Document usage patterns

**Future Modules to Add:**
- `modules/finance/invoice.ts` - Extract invoice data
- `modules/finance/po.ts` - Extract PO numbers
- `modules/communications/categorization.ts` - Categorize emails
- `modules/communications/sentiment.ts` - Sentiment analysis
- `modules/shipping/label.ts` - Extract from shipping labels (OCR + AI)

---

## Example: Adding a New Module

```typescript
// modules/finance/invoice.ts
import { createExtractor } from '../../core/extraction-client'
import { InvoiceSchema } from './schemas'

export async function extractInvoice(pdfText: string) {
  const extractor = createExtractor()
  
  return extractor.extract({
    input: pdfText,
    schema: InvoiceSchema,
    instructions: "Extract invoice details including amounts, dates, and line items",
  })
}
```

**Usage:**
```typescript
import { extractInvoice } from '@/lib/infrastructure/sdks/extraction/modules/finance'
const invoice = await extractInvoice(pdfText)
```

---

**Should I implement Option 5 (Hybrid)?** 🚀
