import { Suspense } from 'react'
import OrdersTable from '@/components/OrdersTable'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Skeleton } from '@/components/ui/skeleton'

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader />
        
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            Orders
          </h2>
          <p className="text-muted-foreground mb-6">
            View orders and their associated shipments
          </p>
          
          <Suspense fallback={<OrdersTableSkeleton />}>
            <OrdersTable />
          </Suspense>
        </div>
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
