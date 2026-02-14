'use client'

import { Auth0Provider } from '@auth0/nextjs-auth0/client'

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Auth0 user provider wrapper.
 * 
 * Provides user context to the entire application.
 * Must wrap the app in the root layout.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <Auth0Provider>{children}</Auth0Provider>
}
