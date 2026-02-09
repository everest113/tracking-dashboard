/**
 * Extraction SDK
 * 
 * Hybrid extraction framework with:
 * - Generic core for flexible, one-off extractions
 * - Domain-specific modules for optimized, common tasks
 * 
 * ## Usage
 * 
 * ### Domain-Optimized (Recommended for common tasks)
 * ```typescript
 * import { extractTracking } from '@/lib/infrastructure/sdks/extraction'
 * const result = await extractTracking(messages)
 * ```
 * 
 * ### Generic (For custom/one-off extractions)
 * ```typescript
 * import { createExtractionClient } from '@/lib/infrastructure/sdks/extraction'
 * const client = createExtractionClient()
 * const result = await client.extract({
 *   input: text,
 *   schema: MySchema,
 *   instructions: "Extract..."
 * })
 * ```
 */

// Core (generic extraction)
export * from './core'

// Modules (domain-optimized)
export * from './modules/shipping'
