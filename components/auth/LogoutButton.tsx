'use client'

import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

/**
 * Logout button that redirects to Auth0 logout.
 */
export function LogoutButton({ className, variant = 'ghost' }: LogoutButtonProps) {
  return (
    <Button asChild variant={variant} className={className}>
      <a href="/auth/logout">Log Out</a>
    </Button>
  )
}
