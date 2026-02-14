import { auth0 } from '@/lib/auth0'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string }>
}

/**
 * Login page for unauthenticated users.
 * Redirects to dashboard if already logged in.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Check if user is already authenticated
  const session = await auth0.getSession()

  if (session) {
    // Already logged in, redirect to dashboard or returnTo
    const params = await searchParams
    redirect(params.returnTo ?? '/')
  }

  const params = await searchParams
  const returnTo = params.returnTo ?? '/'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Shipment Tracking</CardTitle>
          <CardDescription>
            Sign in to access your shipment dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <a
            href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            Sign in with Auth0
          </a>
          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
