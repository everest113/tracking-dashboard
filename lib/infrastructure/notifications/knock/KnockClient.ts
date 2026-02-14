import { Knock } from '@knocklabs/node'

let knockClient: Knock | null = null

/**
 * Get the Knock client singleton.
 * Returns null if KNOCK_API_KEY is not configured.
 */
export function getKnockClient(): Knock | null {
  if (knockClient) return knockClient

  const apiKey = process.env.KNOCK_API_KEY
  if (!apiKey) return null

  knockClient = new Knock(apiKey)
  return knockClient
}

/**
 * Check if Knock is configured.
 */
export function isKnockConfigured(): boolean {
  return !!process.env.KNOCK_API_KEY
}

/**
 * Reset the client (useful for testing).
 */
export function resetKnockClient(): void {
  knockClient = null
}
