/**
 * API test helpers
 * For testing Next.js API routes
 */

import { NextRequest } from 'next/server'

/**
 * Create a mock Next.js request object for testing
 */
export function createMockRequest(options: {
  method?: string
  url?: string
  body?: unknown
  headers?: Record<string, string>
}): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    headers = {},
  } = options

  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  })

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(url, requestInit)
}

/**
 * Parse response body as JSON
 */
export async function parseResponseBody<T = unknown>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Failed to parse response as JSON: ${text}`)
  }
}

/**
 * Assert response status and return parsed body
 */
export async function assertResponse<T = unknown>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  if (response.status !== expectedStatus) {
    const body = await response.text()
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${body}`
    )
  }
  return parseResponseBody<T>(response)
}
