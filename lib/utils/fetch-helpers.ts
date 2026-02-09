/**
 * Type-safe fetch helpers
 * Architectural pattern for handling API responses in components and routes
 */

import { z } from 'zod'

/**
 * Type guard for checking if response has error
 */
export function isErrorResponse(data: unknown): data is { error: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'string'
  )
}

/**
 * Type guard for checking if response is successful
 */
export function isSuccessResponse<T>(
  data: unknown,
  schema: z.ZodType<T>
): data is T {
  const result = schema.safeParse(data)
  return result.success
}

/**
 * Parse and validate API response
 * Throws if response is not ok or doesn't match schema
 */
export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>
): Promise<T> {
  const response = await fetch(url, options)
  const data: unknown = await response.json()

  if (!response.ok) {
    if (isErrorResponse(data)) {
      throw new Error(data.error)
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  if (schema) {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid response format: ${result.error.message}`)
    }
    return result.data
  }

  return data as T
}

/**
 * Safe JSON parse with error handling
 */
export function parseJsonSafe<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (isErrorResponse(error)) return error.error
  return 'An unknown error occurred'
}

/**
 * Type-safe response wrapper
 */
export type ApiResult<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Create success result
 */
export function success<T, E = string>(data: T): ApiResult<T, E> {
  return { success: true, data }
}

/**
 * Create error result
 */
export function failure<E = string>(error: E): ApiResult<never, E> {
  return { success: false, error }
}

/**
 * Transform API result
 */
export function mapResult<T, U, E>(
  result: ApiResult<T, E>,
  fn: (data: T) => U
): ApiResult<U, E> {
  if (result.success) {
    return success(fn(result.data))
  }
  return result
}
