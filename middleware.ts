import type { NextRequest } from 'next/server'
import { auth0 } from './lib/auth0'

/**
 * Auth0 middleware.
 * 
 * Handles authentication routes and session management.
 * Routes:
 * - /auth/login    - Redirects to Auth0 login
 * - /auth/logout   - Logs user out
 * - /auth/callback - Handles Auth0 callback
 */
export async function middleware(request: NextRequest) {
  return await auth0.middleware(request)
}

export const config = {
  // Match all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/webhooks).*)',
  ],
}
