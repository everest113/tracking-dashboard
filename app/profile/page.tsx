import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/api/auth/login')
  }

  const initials = user.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarImage src={user.picture ?? undefined} alt={user.name ?? 'User'} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">User ID</dt>
              <dd className="mt-1 font-mono text-xs break-all">{user.sub}</dd>
            </div>
            {user.email_verified !== undefined && (
              <div>
                <dt className="font-medium text-muted-foreground">Email Verified</dt>
                <dd className="mt-1">{user.email_verified ? 'Yes' : 'No'}</dd>
              </div>
            )}
            {user.updated_at && (
              <div>
                <dt className="font-medium text-muted-foreground">Last Updated</dt>
                <dd className="mt-1">{new Date(user.updated_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
