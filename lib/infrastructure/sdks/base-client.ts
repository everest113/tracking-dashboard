/**
 * Base SDK client architecture
 * Provides consistent patterns for all external API clients
 */

import { z } from 'zod'

/**
 * Base configuration for SDK clients
 */
export interface SdkConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
  headers?: Record<string, string>
}

/**
 * Standard error response
 */
export class SdkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message)
    this.name = 'SdkError'
  }
}

/**
 * Base SDK client with common functionality
 */
export abstract class BaseSdkClient {
  protected constructor(
    protected readonly config: SdkConfig
  ) {}

  /**
   * Make HTTP request with automatic error handling and validation
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodType<T>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    const headers = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...options.headers,
    }

    if (this.config.apiKey) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const data: unknown = await response.json()

      if (!response.ok) {
        throw new SdkError(
          this.extractErrorMessage(data),
          response.status,
          data
        )
      }

      // Validate response if schema provided
      if (schema) {
        const result = schema.safeParse(data)
        if (!result.success) {
          throw new SdkError(
            `Invalid response format: ${result.error.message}`,
            response.status,
            data
          )
        }
        return result.data
      }

      return data as T
    } catch (error) {
      if (error instanceof SdkError) {
        throw error
      }
      if (error instanceof Error) {
        throw new SdkError(error.message)
      }
      throw new SdkError('Unknown error occurred')
    }
  }

  /**
   * Extract error message from response
   */
  protected extractErrorMessage(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if (typeof obj.error === 'string') return obj.error
      if (typeof obj.message === 'string') return obj.message
      if (typeof obj._error === 'object' && obj._error !== null) {
        const errorObj = obj._error as Record<string, unknown>
        if (typeof errorObj.message === 'string') return errorObj.message
      }
    }
    return 'Unknown API error'
  }

  /**
   * GET request
   */
  protected async get<T>(
    endpoint: string,
    schema?: z.ZodType<T>
  ): Promise<T> {
    return this.request(endpoint, { method: 'GET' }, schema)
  }

  /**
   * POST request
   */
  protected async post<T>(
    endpoint: string,
    body: unknown,
    schema?: z.ZodType<T>
  ): Promise<T> {
    return this.request(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      schema
    )
  }

  /**
   * PUT request
   */
  protected async put<T>(
    endpoint: string,
    body: unknown,
    schema?: z.ZodType<T>
  ): Promise<T> {
    return this.request(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      schema
    )
  }

  /**
   * DELETE request
   */
  protected async delete<T>(
    endpoint: string,
    schema?: z.ZodType<T>
  ): Promise<T> {
    return this.request(endpoint, { method: 'DELETE' }, schema)
  }
}
