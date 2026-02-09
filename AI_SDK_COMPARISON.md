# AI SDK Comparison: Raw OpenAI vs Vercel AI SDK

## Decision: ✅ Vercel AI SDK (Chosen)

## Side-by-Side Comparison

### 1. Type Safety

**Raw OpenAI SDK:**
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  response_format: { type: 'json_object' },  // ⚠️ Just hints, not enforced
})

const content = completion.choices[0]?.message?.content
const result = JSON.parse(content)  // ❌ No validation, any type
//    ^? result: any
```

**Vercel AI SDK:**
```typescript
const { object } = await generateObject({
  model: openai('gpt-4o-mini'),
  schema: ExtractionResultSchema,  // ✅ Zod schema enforced
  prompt: '...',
})

console.log(object)
//          ^? ExtractionResult (fully typed!)
```

### 2. Structured Outputs

**Raw OpenAI SDK:**
```typescript
// ❌ Manual prompt engineering for JSON
const prompt = `Return a JSON object with shipments array...`

// ❌ Manual JSON parsing (can fail)
const result = JSON.parse(content)

// ❌ Manual validation
if (!result.shipments || !Array.isArray(result.shipments)) {
  throw new Error('Invalid response')
}
```

**Vercel AI SDK:**
```typescript
// ✅ Schema defines structure
const schema = z.object({
  shipments: z.array(ExtractedShipmentSchema),
  supplier: z.string().optional(),
})

// ✅ Auto-parsed, auto-validated
const { object } = await generateObject({ schema, ... })
// object is guaranteed to match schema!
```

### 3. Error Handling

**Raw OpenAI SDK:**
```typescript
try {
  const completion = await openai.chat.completions.create({...})
  const content = completion.choices[0]?.message?.content
  
  if (!content) {
    throw new Error('No content')
  }
  
  const result = JSON.parse(content)  // Can throw
  
  // Manual validation
  if (!isValidResult(result)) {
    throw new Error('Invalid result')
  }
  
  return result
} catch (error) {
  // ❌ Many failure points to handle
  console.error(error)
  return { shipments: [] }
}
```

**Vercel AI SDK:**
```typescript
try {
  const { object } = await generateObject({ schema, ... })
  return object  // ✅ Already validated by Zod
} catch (error) {
  // ✅ Single error point, clear error messages
  console.error('Extraction error:', error)
  return { shipments: [] }
}
```

### 4. Provider Switching

**Raw OpenAI SDK:**
```typescript
// ❌ Vendor lock-in, different APIs
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: '...' })

// To switch to Anthropic:
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: '...' })

// ❌ Completely different API!
const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [...],  // Different structure
})
```

**Vercel AI SDK:**
```typescript
// ✅ Unified API across providers
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

// Same API, different model
const { object } = await generateObject({
  model: openai('gpt-4o-mini'),      // ✅ Easy switch
  // model: anthropic('claude-3-5-sonnet-20241022'),
  schema: ExtractionResultSchema,
  prompt: '...',
})
```

### 5. Streaming

**Raw OpenAI SDK:**
```typescript
// ❌ Verbose streaming setup
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  stream: true,
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) {
    process.stdout.write(content)  // ❌ Manual handling
  }
}
```

**Vercel AI SDK:**
```typescript
// ✅ Built-in streaming with type safety
const { partialObjectStream } = await streamObject({
  model: openai('gpt-4o-mini'),
  schema: ExtractionResultSchema,
  prompt: '...',
})

for await (const partialObject of partialObjectStream) {
  console.log(partialObject)  // ✅ Typed partial updates!
}
```

### 6. Testing

**Raw OpenAI SDK:**
```typescript
// ❌ Hard to mock
jest.mock('openai')

test('extraction', async () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({ shipments: [...] })  // ❌ Manual mocking
      }
    }]
  })
  
  OpenAI.prototype.chat.completions.create = mockCreate
  
  const result = await extractTrackingInfo([...])
  expect(result.shipments).toHaveLength(1)
})
```

**Vercel AI SDK:**
```typescript
// ✅ Easy to mock at infrastructure layer
jest.mock('@/lib/infrastructure/sdks/tracking-extraction/vercel-ai-client')

test('extraction', async () => {
  const mockClient = {
    extractFromEmails: jest.fn().mockResolvedValue({
      supplier: 'Acme',
      shipments: [...]  // ✅ Clean mocking
    })
  }
  
  (createTrackingExtractionClient as jest.Mock).mockReturnValue(mockClient)
  
  const result = await extractTrackingFromEmail([...])
  expect(result.supplier).toBe('Acme')
})
```

### 7. DDD Integration

**Raw OpenAI SDK:**
```typescript
// ❌ Mixed concerns
export async function extractTrackingInfo(messages) {
  // Infrastructure code
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  // Domain logic
  const prompt = buildPrompt(messages)
  
  // Infrastructure code
  const completion = await openai.chat.completions.create({...})
  
  // Domain logic
  const result = normalizeTrackingNumbers(JSON.parse(content))
  
  return result
}
```

**Vercel AI SDK:**
```typescript
// ✅ Clean separation

// Infrastructure (SDK layer)
export class TrackingExtractionClient {
  async extractFromEmails(messages: EmailMessage[]): Promise<ExtractionResult> {
    const { object } = await generateObject({...})
    return object
  }
}

// Application (Use case layer)
export async function extractTrackingFromEmail(messages: EmailMessage[]) {
  const client = createTrackingExtractionClient()
  const result = await client.extractFromEmails(messages)
  
  // Business rules
  if (!result.supplier && messages[0]?.senderName) {
    result.supplier = messages[0].senderName
  }
  
  return result
}
```

### 8. Code Size

**Raw OpenAI SDK:**
```typescript
// tracking-extractor.ts: 145 lines
// - Manual JSON parsing
// - Manual validation
// - Manual error handling
// - Global state management
```

**Vercel AI SDK:**
```typescript
// Infrastructure + Application: 180 lines total
// - schemas.ts: 40 lines (Zod schemas)
// - prompts.ts: 80 lines (extracted from logic)
// - vercel-ai-client.ts: 45 lines (clean client)
// - extractTrackingFromEmail.ts: 15 lines (use case)

// ✅ More lines BUT better separation
// ✅ Each file has single responsibility
// ✅ Easier to maintain and test
```

## Cost & Performance

| Metric | Raw OpenAI SDK | Vercel AI SDK | Winner |
|--------|---------------|---------------|--------|
| **Latency** | ~1-3 sec | ~1-3 sec | Tie ⚖️ |
| **Cost per call** | $0.0002 | $0.0002 | Tie ⚖️ |
| **Bundle size** | +40kb | +60kb | OpenAI (but negligible) |
| **Type safety** | ❌ None | ✅ Full | **Vercel AI** |
| **DX** | ❌ Poor | ✅ Excellent | **Vercel AI** |
| **Testability** | ❌ Hard | ✅ Easy | **Vercel AI** |

## When to Use Each

### Use Raw OpenAI SDK When:
- ❌ You need absolutely minimal bundle size (serverless edge functions)
- ❌ You're doing something very custom that Vercel AI doesn't support
- ❌ You only use OpenAI and never plan to switch

### Use Vercel AI SDK When:
- ✅ You want type safety (most projects)
- ✅ You follow clean architecture / DDD
- ✅ You might switch AI providers later
- ✅ You want structured outputs with validation
- ✅ You need streaming
- ✅ You care about DX and maintainability

## Verdict

**For tracking-dashboard:** ✅ **Vercel AI SDK is the clear winner**

**Reasons:**
1. We already use DDD architecture → clean separation needed
2. Type safety is critical for production systems
3. We might want to try Claude/other models later
4. Structured outputs eliminate entire class of bugs
5. Testing is much easier
6. Better long-term maintainability

**Trade-off:** +20kb bundle size is negligible for a server-side Next.js app.

---

**Recommendation:** Use Vercel AI SDK for any new AI features in this project.
