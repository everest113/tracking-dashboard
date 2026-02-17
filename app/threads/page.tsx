import { Suspense } from 'react'
import ThreadReviewQueue from '@/components/ThreadReviewQueue'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Skeleton } from '@/components/ui/skeleton'

export default function ThreadsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader />
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Customer Threads</h1>
          <p className="text-muted-foreground">
            Review and approve matched Front conversations for tracking notifications
          </p>
        </div>
        
        <Suspense fallback={<ThreadsTableSkeleton />}>
          <ThreadReviewQueue />
        </Suspense>
      </div>
    </main>
  )
}

function ThreadsTableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  )
}
