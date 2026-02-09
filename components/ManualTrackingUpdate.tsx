'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

interface TrackingUpdateResponse {
  success: boolean
  checked: number
  updated: number
  errors: number
  durationMs: number
}

export default function ManualTrackingUpdate({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleUpdate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/manual-update-tracking', {
        method: 'POST',
      })

      const data: unknown = await response.json()

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String(data.error)
            : 'Update failed'
        )
      }

      const result = data as TrackingUpdateResponse

      toast.success(`Updated ${result.checked} shipments`, {
        description: `${result.updated} status changes, ${result.errors} errors`,
      })

      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleUpdate} disabled={loading} variant="outline">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Updating...' : 'Update Tracking'}
    </Button>
  )
}
