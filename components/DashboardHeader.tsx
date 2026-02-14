import { UserMenu } from '@/components/auth'
import LastSyncDisplay from '@/components/LastSyncDisplay'

/**
 * Dashboard header with title, last sync time, and user menu.
 */
export function DashboardHeader() {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Shipment Tracking Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor all shipments and tracking status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LastSyncDisplay />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
