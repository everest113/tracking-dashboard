/**
 * Type-safe API hooks for components
 * Architectural pattern for consuming internal APIs
 */

'use client'

import { useState, useCallback } from 'react'
import { z } from 'zod'
import { fetchJson, getErrorMessage } from '../utils/fetch-helpers'

/**
 * Hook state
 */
export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Hook for type-safe API calls
 */
export function useApi<T>(
  schema?: z.ZodType<T>
): {
  state: UseApiState<T>
  execute: (url: string, options?: RequestInit) => Promise<T>
  reset: () => void
} {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (url: string, options?: RequestInit): Promise<T> => {
      setState({ data: null, loading: true, error: null })

      try {
        const result = await fetchJson<T>(url, options, schema)
        setState({ data: result, loading: false, error: null })
        return result
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        setState({ data: null, loading: false, error: errorMessage })
        throw error
      }
    },
    [schema]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { state, execute, reset }
}

/**
 * Hook for mutations (POST, PUT, DELETE)
 */
export function useMutation<T, TVariables = unknown>(
  url: string,
  schema?: z.ZodType<T>
): {
  state: UseApiState<T>
  mutate: (variables: TVariables, options?: Omit<RequestInit, 'body'>) => Promise<T>
  reset: () => void
} {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const mutate = useCallback(
    async (variables: TVariables, options?: Omit<RequestInit, 'body'>): Promise<T> => {
      setState({ data: null, loading: true, error: null })

      try {
        const result = await fetchJson<T>(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(variables),
            ...options,
          },
          schema
        )
        setState({ data: result, loading: false, error: null })
        return result
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        setState({ data: null, loading: false, error: errorMessage })
        throw error
      }
    },
    [url, schema]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { state, mutate, reset }
}
