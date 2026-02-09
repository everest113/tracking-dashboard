'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function ManualTrackingUpdate() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  const handleUpdate = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/manual-update-tracking', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Updated ${data.updated} of ${data.checked} shipments in ${Math.round(data.durationMs / 1000)}s`,
          details: data,
        })
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to update tracking',
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Network error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleUpdate}
        disabled={loading}
        variant="outline"
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Updating Tracking...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update All Tracking Now
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.success ? 'default' : 'destructive'}>
          {result.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {result.message}
            {result.details?.errors > 0 && (
              <div className="mt-1 text-xs opacity-75">
                {result.details.errors} errors occurred
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
