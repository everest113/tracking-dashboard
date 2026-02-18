import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from './lib/auth0'

/**
 * Allowed email domains for access.
 * Only users with emails from these domains can access the app.
 */
const ALLOWED_EMAIL_DOMAINS = ['stitchi.co']

/**
 * Public routes that don't require authentication.
 * - /auth/* - Auth0 routes (login, logout, callback)
 * - /api/webhooks/* - Webhook endpoints
 * - /api/cron/* - Cron job endpoints (protected by CRON_SECRET)
 * - /api/orpc/* - oRPC endpoints (protected by CRON_SECRET header for automation)
 * - /login - Login page for unauthenticated users
 * - /unauthorized - Shown to users without access
 */
const PUBLIC_ROUTES = ['/auth', '/api/webhooks', '/api/cron', '/login', '/unauthorized']

/**
 * Check if request has valid cron authorization.
 * Allows cron jobs to bypass auth using CRON_SECRET header.
 */
function hasCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Check if a path is a public route.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Check if an email is from an allowed domain.
 */
function isAllowedEmail(email: string | undefined): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain)
}

/**
 * Auth0 middleware with route protection.
 *
 * - Public routes: Accessible without authentication
 * - Protected routes: Redirects to /login if not authenticated
 * - Domain check: Only @stitchi.co emails can access
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

  // Allow cron jobs with valid CRON_SECRET to bypass auth
  if (request.nextUrl.pathname.startsWith('/api/orpc') && hasCronAuth(request)) {
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

  // Check if user's email is from an allowed domain
  if (!isAllowedEmail(session.user.email)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // User is authenticated and authorized, return the auth response
  return authResponse
}

export const config = {
  // Match all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
