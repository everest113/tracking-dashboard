import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldX } from 'lucide-react'

/**
 * Unauthorized page shown when a user authenticates but isn't allowed access.
 * This happens when their email domain isn't in the allowlist.
 */
export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don&apos;t have permission to access this application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center">
            This application is restricted to authorized Stitchi team members.
            If you believe you should have access, please contact your administrator.
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href="/auth/logout">Sign out and try a different account</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
