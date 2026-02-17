import { Suspense } from 'react'
import OrdersTable from '@/components/OrdersTable'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Skeleton } from '@/components/ui/skeleton'

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader />
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            View orders, their POs, and associated shipments
          </p>
        </div>
        
        <Suspense fallback={<OrdersTableSkeleton />}>
          <OrdersTable />
        </Suspense>
      </div>
    </main>
  )
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}
