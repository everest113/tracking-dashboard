'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { api } from '@/lib/orpc/client'

interface RefreshNowProps {
  onSuccess: () => void
}

export default function RefreshNow({ onSuccess }: RefreshNowProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      // Step 1: Backfill untracked shipments (register with Ship24)
      const backfillResult = await api.trackers.backfill()

      // Step 2: Update all tracking statuses (fetch latest from Ship24)
      const updateResult = await api.manualUpdateTracking.update()

      // Show combined success message
      const backfillCount = backfillResult.registered || 0
      const messages: string[] = []
      
      if (backfillCount > 0) {
        messages.push(`${backfillCount} shipment${backfillCount !== 1 ? 's' : ''} enrolled in tracking`)
      }
      
      messages.push(`${updateResult.checked} shipment${updateResult.checked !== 1 ? 's' : ''} refreshed`)
      
      if (updateResult.updated > 0) {
        messages.push(`${updateResult.updated} status change${updateResult.updated !== 1 ? 's' : ''}`)
      }

      toast.success('Dashboard refreshed', {
        description: messages.join(' • '),
      })

      onSuccess()
    } catch (error) {
      toast.error('Refresh failed', {
        description: getErrorMessage(error) || 'An unexpected error occurred.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleRefresh} disabled={loading} variant="default">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Refreshing...' : 'Refresh Now'}
    </Button>
  )
}
