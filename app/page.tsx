import { Suspense } from 'react'
import ShipmentTable from '@/components/ShipmentTable'
import StatusTabs from '@/components/StatusTabs'
import LastSyncDisplay from '@/components/LastSyncDisplay'
import RefreshNow from '@/components/RefreshNow'
import StaleDataBanner from '@/components/StaleDataBanner'
import TableSkeleton from '@/components/TableSkeleton'
import { getShipments, type ShipmentQueryParams } from '@/lib/data/shipments'

interface PageProps {
  searchParams: Promise<ShipmentQueryParams>
}

// Async Server Component that fetches data
async function ShipmentsData({ params }: { params: ShipmentQueryParams }) {
  const data = await getShipments(params)
  const activeTab = params.tab || 'all'

  return (
    <>
      <StatusTabs
        counts={data.statusCounts}
        activeTab={activeTab}
      />
      <ShipmentTable
        shipments={data.items}
        pagination={data.pagination}
        activeStatus={activeTab}
      />
    </>
  )
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
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
              <RefreshNow />
            </div>
          </div>
        </div>

        {/* Stale Data Warning */}
        <StaleDataBanner />

        {/* Data with Suspense */}
        <Suspense fallback={<TableSkeleton />}>
          <ShipmentsData params={params} />
        </Suspense>
      </div>
    </main>
  )
}
