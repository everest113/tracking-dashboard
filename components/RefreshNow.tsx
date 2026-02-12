'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { api } from '@/lib/orpc/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface RefreshNowProps {
  onSuccess: () => void
}

export default function RefreshNow({ onSuccess }: RefreshNowProps) {
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customDate, setCustomDate] = useState<string | null>(null)
  const [forceRescan, setForceRescan] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [hasStarted, setHasStarted] = useState(false)

  // Enable force rescan option (re-analyze already-scanned conversations)
  // Set NEXT_PUBLIC_ENABLE_FORCE_RESCAN=true in .env.local to enable
  const forceRescanEnabled = process.env.NEXT_PUBLIC_ENABLE_FORCE_RESCAN === 'true'

  useEffect(() => {
    if (showDialog && !hasStarted) {
      // Reset state when dialog opens
      setProgress([])
      setShowAdvanced(false)
      setCustomDate(null)
      setForceRescan(false)
    }
  }, [showDialog, hasStarted])

  const addProgress = (message: string) => {
    setProgress(prev => [...prev, message])
  }

  const getStartDate = async (): Promise<string> => {
    // Use custom date if provided
    if (customDate) {
      return customDate
    }

    // Otherwise, try to get last sync date
    try {
      const syncHistory = await api.syncHistory.get({ limit: 1 })
      if (syncHistory.lastSync && syncHistory.lastSync.startedAt) {
        const lastSyncDate = new Date(syncHistory.lastSync.startedAt)
        return lastSyncDate.toISOString().split('T')[0]
      }
    } catch (error) {
      console.error('Failed to fetch last sync:', error)
    }

    // Fallback: 14 days ago
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    return fourteenDaysAgo.toISOString().split('T')[0]
  }

  const handleRefresh = async () => {
    setLoading(true)
    setHasStarted(true)
    setProgress([])

    try {
      // Step 1: Scan Front inbox for new shipments
      addProgress('🔍 Scanning Front inbox for new tracking numbers...')
      const startDate = await getStartDate()
      const formattedDate = new Date(startDate).toLocaleDateString()
      addProgress(`📅 Checking conversations from ${formattedDate}`)

      const scanResult = await api.front.scan({
        after: startDate,
        forceRescan: forceRescan && forceRescanEnabled,
      })

      if (scanResult.summary.shipmentsAdded > 0) {
        addProgress(`✅ Found ${scanResult.summary.shipmentsAdded} new shipment${scanResult.summary.shipmentsAdded !== 1 ? 's' : ''}`)
      } else {
        addProgress('ℹ️ No new shipments found')
      }

      if (scanResult.summary.conversationsAlreadyScanned > 0) {
        addProgress(`⏭️ Skipped ${scanResult.summary.conversationsAlreadyScanned} already-scanned conversation${scanResult.summary.conversationsAlreadyScanned !== 1 ? 's' : ''}`)
      }

      // Step 2: Backfill untracked shipments (register with Ship24)
      addProgress('📦 Enrolling shipments in tracking...')
      const backfillResult = await api.trackers.backfill()

      if (backfillResult.registered > 0) {
        addProgress(`✅ Enrolled ${backfillResult.registered} shipment${backfillResult.registered !== 1 ? 's' : ''} for tracking`)
      } else {
        addProgress('ℹ️ All shipments already enrolled')
      }

      // Step 3: Update all tracking statuses (fetch latest from Ship24)
      addProgress('🔄 Fetching latest tracking statuses...')
      const updateResult = await api.manualUpdateTracking.update()

      addProgress(`✅ Refreshed ${updateResult.checked} shipment${updateResult.checked !== 1 ? 's' : ''}`)
      
      if (updateResult.updated > 0) {
        addProgress(`📊 ${updateResult.updated} status change${updateResult.updated !== 1 ? 's' : ''} detected`)
      }

      addProgress('✨ Refresh complete!')

      // Show summary toast
      const messages: string[] = []
      if (scanResult.summary.shipmentsAdded > 0) {
        messages.push(`${scanResult.summary.shipmentsAdded} new`)
      }
      if (backfillResult.registered > 0) {
        messages.push(`${backfillResult.registered} enrolled`)
      }
      messages.push(`${updateResult.checked} refreshed`)

      toast.success('Dashboard updated', {
        description: messages.join(' • '),
      })

      onSuccess()
    } catch (error) {
      addProgress(`❌ Error: ${getErrorMessage(error)}`)
      toast.error('Refresh failed', {
        description: getErrorMessage(error) || 'An unexpected error occurred.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = () => {
    setShowDialog(true)
    setHasStarted(false)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setHasStarted(false)
    setProgress([])
  }

  return (
    <>
      <Button onClick={handleOpenDialog} disabled={loading} variant="default">
        <RefreshCw className="h-4 w-4" />
        Refresh Now
      </Button>

      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {!hasStarted && 'Refresh Dashboard'}
              {hasStarted && loading && 'Refreshing Dashboard...'}
              {hasStarted && !loading && 'Refresh Complete'}
            </DialogTitle>
            <DialogDescription>
              {!hasStarted && 'Scan for new shipments and update tracking statuses'}
              {hasStarted && loading && 'Scanning for new shipments and updating statuses'}
              {hasStarted && !loading && 'Dashboard has been updated'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Show configuration BEFORE starting */}
            {!hasStarted && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    This will scan Front inbox for new tracking numbers, enroll shipments in tracking, and fetch the latest statuses.
                  </p>
                </div>

                {/* Advanced configuration */}
                <div className="space-y-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full justify-between"
                  >
                    <span className="text-sm font-medium">Advanced Settings</span>
                    {showAdvanced ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {showAdvanced && (
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="space-y-2">
                        <Label htmlFor="customDate">Custom start date</Label>
                        <Input
                          id="customDate"
                          type="date"
                          value={customDate || ''}
                          onChange={(e) => setCustomDate(e.target.value || null)}
                          max={new Date().toISOString().split('T')[0]}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to use last sync date (or 14 days ago if never synced)
                        </p>
                      </div>

                      {forceRescanEnabled && (
                        <div className="flex items-start space-x-3 rounded-md border border-orange-200 bg-orange-50 p-3">
                          <Checkbox
                            id="forceRescan"
                            checked={forceRescan}
                            onCheckedChange={(checked) => setForceRescan(checked as boolean)}
                          />
                          <div className="space-y-1">
                            <label
                              htmlFor="forceRescan"
                              className="text-sm font-medium leading-none"
                            >
                              Force rescan
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Re-analyze already-scanned conversations. Uses AI credits.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show progress AFTER starting */}
            {hasStarted && (
              <div className="rounded-md bg-muted p-4 max-h-[300px] overflow-y-auto">
                {progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Initializing...</p>
                ) : (
                  <div className="space-y-1">
                    {progress.map((msg, i) => (
                      <p key={i} className="text-sm font-mono">{msg}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          {!hasStarted && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleRefresh} disabled={loading}>
                Start Refresh
              </Button>
            </div>
          )}

          {hasStarted && !loading && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setHasStarted(false)
                setProgress([])
              }}>
                Refresh Again
              </Button>
              <Button onClick={handleCloseDialog}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
