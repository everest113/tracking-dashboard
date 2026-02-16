import { Suspense } from 'react'
import ThreadReviewQueue from '@/components/ThreadReviewQueue'
import { DashboardHeader } from '@/components/DashboardHeader'

export default function ThreadsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader />
        
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-6">
            Customer Thread Matching
          </h2>
          <p className="text-muted-foreground mb-6">
            Review and approve automatically matched Front conversations for shipment notifications.
          </p>
          
          <Suspense fallback={<div>Loading...</div>}>
            <ThreadReviewQueue />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
