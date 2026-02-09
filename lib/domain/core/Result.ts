/**
 * Result Type for Railway-Oriented Programming
 * Represents either a success value or an error
 * Makes errors explicit in the type system
 */

export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E }

/**
 * Create a successful result
 */
export const Ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
})

/**
 * Create an error result
 */
export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
})

/**
 * Result utility functions
 */
export const Result = {
  /**
   * Map over a successful result
   */
  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
    if (result.success) {
      return Ok(fn(result.value))
    }
    return result
  },

  /**
   * Chain results (flatMap)
   */
  flatMap: <T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> => {
    if (result.success) {
      return fn(result.value)
    }
    return result
  },

  /**
   * Get value or default
   */
  getOrElse: <T, E>(result: Result<T, E>, defaultValue: T): T => {
    if (result.success) {
      return result.value
    }
    return defaultValue
  },

  /**
   * Get value or throw error
   */
  unwrap: <T, E>(result: Result<T, E>): T => {
    if (result.success) {
      return result.value
    }
    throw result.error
  },

  /**
   * Check if result is Ok
   */
  isOk: <T, E>(result: Result<T, E>): result is { success: true; value: T } => {
    return result.success
  },

  /**
   * Check if result is Err
   */
  isErr: <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
    return !result.success
  },

  /**
   * Combine multiple results
   */
  all: <T, E>(results: Result<T, E>[]): Result<T[], E> => {
    const values: T[] = []
    for (const result of results) {
      if (!result.success) {
        return result
      }
      values.push(result.value)
    }
    return Ok(values)
  },
}

/**
 * Domain Error Classes
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}
