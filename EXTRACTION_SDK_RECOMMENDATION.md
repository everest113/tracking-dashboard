# Final Recommendation: Hybrid Extraction SDK

## TL;DR

**Move from:** `tracking-extraction/` (single-purpose)  
**Move to:** `extraction/` with `core/` + `modules/` (extensible)

**Effort:** ~4 hours  
**Value:** Saves 20+ hours over 6 months  
**Risk:** Low (mostly moving code, not rewriting)

---

## Architecture

```
BEFORE (Current):
lib/infrastructure/sdks/
└── tracking-extraction/          ❌ One-trick pony
    ├── schemas.ts
    ├── prompts.ts
    └── vercel-ai-client.ts

AFTER (Hybrid):
lib/infrastructure/sdks/
└── extraction/                   ✅ Extensible framework
    ├── core/
    │   ├── extraction-client.ts  # Generic AI wrapper
    │   ├── prompt-builder.ts     # Auto-generate prompts
    │   └── types.ts              # Shared types
    │
    └── modules/
        ├── shipping/
        │   ├── tracking.ts       # extractTracking()
        │   ├── label.ts          # extractLabel() (future)
        │   └── schemas.ts
        │
        ├── finance/              # Future modules
        │   ├── invoice.ts
        │   ├── po.ts
        │   └── schemas.ts
        │
        └── communications/
            ├── categorization.ts
            └── schemas.ts
```

---

## Why Hybrid? (5 Reasons)

### 1. **Generic Core = Maximum Flexibility**

```typescript
// Handle any extraction task
const extractor = createExtractor()

const data = await extractor.extract({
  input: "Any unstructured text...",
  schema: z.object({ /* your schema */ }),
  instructions: "What to extract"
})
```

**Use case:** One-off extractions, prototyping, custom features

---

### 2. **Domain Modules = Optimized Quality**

```typescript
// Pre-tuned for specific domains
import { extractTracking } from '@/lib/sdks/extraction/modules/shipping'

const tracking = await extractTracking(messages)
// ✅ Optimized prompt
// ✅ Domain-specific validation
// ✅ Better accuracy
```

**Use case:** Common, repeated extractions (tracking, invoices, POs)

---

### 3. **Easy to Extend**

```typescript
// Add new module in 1 hour
// modules/finance/invoice.ts
export async function extractInvoice(pdfText: string) {
  return extractor.extract({
    input: pdfText,
    schema: InvoiceSchema,
    instructions: "Extract invoice details..."
  })
}
```

**Use case:** New business requirements (invoices, POs, etc.)

---

### 4. **Scales Incrementally**

```typescript
// Start with 1 module (tracking)
extraction/modules/shipping/tracking.ts

// Add as needed
extraction/modules/finance/invoice.ts       // Week 2
extraction/modules/communications/cat.ts    // Week 3
extraction/modules/products/feedback.ts     // Month 2
```

**Use case:** Grow with project needs, no big-bang refactor

---

### 5. **Backwards Compatible**

```typescript
// Old code still works (after simple import update)
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'

// New code is cleaner
import { extractTracking } from '@/lib/sdks/extraction/modules/shipping'
```

**Use case:** Gradual migration, no breaking changes

---

## Comparison: All 5 Options

| Criteria | Email Intel | Document Intel | AI Generic | Biz Intel | **Hybrid** |
|----------|-------------|----------------|------------|-----------|------------|
| **Flexibility** | 6/10 | 9/10 | 10/10 | 5/10 | **10/10** |
| **Domain Fit** | 8/10 | 7/10 | 5/10 | 10/10 | **9/10** |
| **Ease of Use** | 7/10 | 6/10 | 9/10 | 8/10 | **9/10** |
| **Reusability** | 6/10 | 9/10 | 10/10 | 4/10 | **9/10** |
| **Scalability** | 7/10 | 9/10 | 8/10 | 7/10 | **10/10** |
| **Initial Effort** | 8/10 | 4/10 | 9/10 | 5/10 | **7/10** |
| **ROI** | 7/10 | 8/10 | 7/10 | 8/10 | **10/10** |
| **TOTAL** | 49/70 | 52/70 | 58/70 | 47/70 | **64/70** |

**Winner:** Hybrid (64/70 = 91%)

---

## Migration Plan

### Phase 1: Extract Core (2 hours)

**Create generic extraction client:**
```typescript
// core/extraction-client.ts
export function createExtractor(model = 'gpt-4o-mini') {
  return {
    async extract({ input, schema, instructions }) {
      const { object } = await generateObject({
        model: openai(model),
        schema,
        system: "You are a precise data extraction assistant.",
        prompt: instructions + "\n\n" + input,
      })
      return object
    }
  }
}
```

### Phase 2: Move Tracking (1 hour)

**Migrate to module:**
```typescript
// modules/shipping/tracking.ts
import { createExtractor } from '../../core/extraction-client'
import { TrackingSchema } from './schemas'
import { buildTrackingPrompt } from './prompts'

export async function extractTracking(messages: EmailMessage[]) {
  const extractor = createExtractor()
  
  return extractor.extract({
    input: buildThreadContext(messages),
    schema: TrackingSchema,
    instructions: buildTrackingPrompt(messages),
  })
}
```

### Phase 3: Update Imports (30 min)

```typescript
// Before
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'

// After
import { extractTracking } from '@/lib/infrastructure/sdks/extraction/modules/shipping'

// Use case becomes thin wrapper
export async function extractTrackingFromEmail(messages: EmailMessage[]) {
  return extractTracking(messages)
}
```

### Phase 4: Add New Module (Proof of Concept) (30 min)

```typescript
// modules/finance/invoice.ts
export async function extractInvoice(input: string) {
  const extractor = createExtractor()
  
  return extractor.extract({
    input,
    schema: InvoiceSchema,
    instructions: "Extract invoice number, date, total, and line items",
  })
}
```

**Total Time:** 4 hours

---

## Future Modules (Prioritized)

### High Priority (Next 3 Months)

1. **`modules/finance/invoice.ts`** - Extract invoice data from emails/PDFs
2. **`modules/finance/po.ts`** - Extract PO numbers from documents
3. **`modules/communications/categorization.ts`** - Categorize emails (rush order, question, complaint)

### Medium Priority (3-6 Months)

4. **`modules/communications/sentiment.ts`** - Analyze customer sentiment
5. **`modules/shipping/label.ts`** - Extract from shipping labels (OCR + AI)
6. **`modules/products/feedback.ts`** - Extract product feedback/issues

### Low Priority (6-12 Months)

7. **`modules/communications/summary.ts`** - Summarize email threads
8. **`modules/products/mentions.ts`** - Find product mentions
9. **`modules/customers/requests.ts`** - Extract customer requests

---

## ROI Analysis

### Time Investment
- **Initial Setup:** 4 hours
- **Per New Module:** 1-2 hours (vs 6-8 hours building from scratch)

### Time Saved
- **Invoice Extraction:** 8 hours saved
- **Email Categorization:** 6 hours saved
- **PO Extraction:** 4 hours saved
- **Custom Extractions:** 2 hours saved each

**Total ROI over 6 months:** 4 hours invested → 20+ hours saved = **5x return**

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Breaking changes** | Low | Medium | Keep use cases as wrappers |
| **Performance regression** | Very Low | Low | Same underlying tech (Vercel AI) |
| **Complexity increase** | Low | Low | Clear module boundaries |
| **Over-engineering** | Medium | Low | Start small, add modules as needed |

**Overall Risk:** Low ✅

---

## Success Criteria

✅ **Tracking extraction still works** (no regression)  
✅ **Can add invoice extraction in <2 hours**  
✅ **Core is reusable** (generic enough)  
✅ **Modules are optimized** (domain-specific quality)  
✅ **Documentation is clear** (easy for future devs)

---

## Decision

### ✅ **RECOMMENDED: Implement Hybrid Extraction SDK**

**Reasons:**
1. Best balance of flexibility + optimization
2. Low risk, high ROI
3. Scales with project needs
4. Easy to add new modules
5. Improves code organization

**Timeline:**
- **Week 1:** Core + tracking module (4 hours)
- **Week 2:** Add invoice module as proof-of-concept (2 hours)
- **Week 3:** Document + optimize (2 hours)

**Total:** 8 hours over 3 weeks

---

## Next Steps

1. **Review this document** - Any concerns?
2. **Approve architecture** - Green light to proceed?
3. **Implement Phase 1** - Extract core (2 hours)
4. **Test & validate** - Ensure tracking still works
5. **Document** - Add usage examples
6. **Deploy** - Ship to production

**Ready to proceed?** 🚀
