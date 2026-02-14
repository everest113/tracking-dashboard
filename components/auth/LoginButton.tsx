'use client'

import { Button } from '@/components/ui/button'

interface LoginButtonProps {
  className?: string
}

/**
 * Login button that redirects to Auth0 login.
 */
export function LoginButton({ className }: LoginButtonProps) {
  return (
    <Button asChild className={className}>
      <a href="/auth/login">Log In</a>
    </Button>
  )
}
