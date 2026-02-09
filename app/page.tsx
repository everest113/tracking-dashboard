import ShipmentTable from '@/components/ShipmentTable'
import LastSyncDisplay from '@/components/LastSyncDisplay'
import { ManualTrackingUpdate } from '@/components/ManualTrackingUpdate'
import BackfillTrackers from '@/components/BackfillTrackers'

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Shipment Tracking Dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Monitor all shipments and tracking status
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <LastSyncDisplay />
              <div className="flex gap-2">
                <BackfillTrackers />
                <ManualTrackingUpdate />
              </div>
            </div>
          </div>
        </div>

        <ShipmentTable />
      </div>
    </main>
  )
}
