import { UserMenu } from '@/components/auth'
import LastSyncDisplay from '@/components/LastSyncDisplay'
import { Navigation } from '@/components/Navigation'

/**
 * Dashboard header with navigation, last sync time, and user menu.
 */
export function DashboardHeader() {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <Navigation />
        <div className="flex items-center gap-4">
          <LastSyncDisplay />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
