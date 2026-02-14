import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from './lib/auth0'

/**
 * Public routes that don't require authentication.
 * - /auth/* - Auth0 routes (login, logout, callback)
 * - /api/webhooks/* - Webhook endpoints
 * - /login - Login page for unauthenticated users
 */
const PUBLIC_ROUTES = ['/auth', '/api/webhooks', '/login']

/**
 * Check if a path is a public route.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Auth0 middleware with route protection.
 *
 * - Public routes: Accessible without authentication
 * - Protected routes: Redirects to /login if not authenticated
 */
export async function middleware(request: NextRequest) {
  // Always run Auth0 middleware first (handles /auth/* routes, session management)
  const authResponse = await auth0.middleware(request)

  // If this is an auth route, return the auth response directly
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return authResponse
  }

  // Public routes don't need auth check
  if (isPublicRoute(request.nextUrl.pathname)) {
    return authResponse
  }

  // Protected routes: check for session
  const session = await auth0.getSession(request)

  if (!session) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // User is authenticated, return the auth response (preserves session cookies)
  return authResponse
}

export const config = {
  // Match all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
