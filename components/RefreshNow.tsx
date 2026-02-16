'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
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
import ProgressStream, { ProgressEvent } from './ProgressStream'

export default function RefreshNow() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customDate, setCustomDate] = useState<string | null>(null)
  const [forceRescan, setForceRescan] = useState(false)
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([])
  const [hasStarted, setHasStarted] = useState(false)

  // Enable force rescan option (re-analyze already-scanned conversations)
  // Set NEXT_PUBLIC_ENABLE_FORCE_RESCAN=true in .env.local to enable
  const forceRescanEnabled = process.env.NEXT_PUBLIC_ENABLE_FORCE_RESCAN === 'true'

  useEffect(() => {
    if (showDialog && !hasStarted) {
      // Reset state when dialog opens
      setProgressEvents([])
      setShowAdvanced(false)
      setCustomDate(null)
      setForceRescan(false)
    }
  }, [showDialog, hasStarted])

  const addProgress = (type: ProgressEvent['type'], message: string) => {
    setProgressEvents(prev => [...prev, { type, message, timestamp: Date.now() }])
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
    setProgressEvents([])

    try {
      // Step 1: Scan Front inbox for new shipments
      addProgress('processing', 'Scanning Front inbox for new tracking numbers...')
      const startDate = await getStartDate()
      const formattedDate = new Date(startDate).toLocaleDateString()
      addProgress('processing', `Checking conversations from ${formattedDate}`)

      const scanResult = await api.front.scan({
        after: startDate,
        forceRescan: forceRescan && forceRescanEnabled,
      })

      if (scanResult.summary.shipmentsAdded > 0) {
        addProgress('found', `${scanResult.summary.shipmentsAdded} new shipment${scanResult.summary.shipmentsAdded !== 1 ? 's' : ''} found!`)
      } else {
        addProgress('skipped', 'No new shipments found')
      }

      if (scanResult.summary.conversationsAlreadyScanned > 0) {
        addProgress('skipped', `${scanResult.summary.conversationsAlreadyScanned} conversation${scanResult.summary.conversationsAlreadyScanned !== 1 ? 's' : ''} already scanned`)
      }

      // Step 2: Backfill untracked shipments (register with Ship24)
      addProgress('processing', 'Enrolling shipments in tracking...')
      const backfillResult = await api.trackers.backfill()

      if (backfillResult.registered > 0) {
        addProgress('found', `${backfillResult.registered} shipment${backfillResult.registered !== 1 ? 's' : ''} enrolled for tracking`)
      } else {
        addProgress('skipped', 'All shipments already enrolled')
      }

      // Step 3: Update all tracking statuses (fetch latest from Ship24)
      addProgress('processing', 'Fetching latest tracking statuses...')
      const updateResult = await api.manualUpdateTracking.update()

      addProgress('complete', `Refreshed ${updateResult.checked} shipment${updateResult.checked !== 1 ? 's' : ''}`)
      
      if (updateResult.updated > 0) {
        addProgress('found', `${updateResult.updated} status change${updateResult.updated !== 1 ? 's' : ''} detected`)
      }

      // Step 4: Sync unlinked shipments with OMG Orders
      addProgress('processing', 'Linking shipments to OMG Orders...')
      const omgResult = await api.omg.batchSync({ limit: 50 })

      if (omgResult.synced > 0) {
        addProgress('found', `${omgResult.synced} shipment${omgResult.synced !== 1 ? 's' : ''} linked to OMG`)
      } else {
        addProgress('skipped', 'All shipments already linked to OMG')
      }

      if (omgResult.failed > 0) {
        addProgress('skipped', `${omgResult.failed} shipment${omgResult.failed !== 1 ? 's' : ''} not found in OMG`)
      }

      // Step 5: Sync orders table (compute statuses)
      addProgress('processing', 'Computing order statuses...')
      const ordersResult = await api.orders.sync()
      
      if (ordersResult.created > 0 || ordersResult.updated > 0) {
        addProgress('found', `${ordersResult.total} order${ordersResult.total !== 1 ? 's' : ''} synced`)
      } else {
        addProgress('skipped', 'Orders already up to date')
      }

      addProgress('complete', 'Refresh complete!')

      // Show summary toast
      const messages: string[] = []
      if (scanResult.summary.shipmentsAdded > 0) {
        messages.push(`${scanResult.summary.shipmentsAdded} new`)
      }
      if (backfillResult.registered > 0) {
        messages.push(`${backfillResult.registered} enrolled`)
      }
      if (omgResult.synced > 0) {
        messages.push(`${omgResult.synced} linked to OMG`)
      }
      messages.push(`${updateResult.checked} refreshed`)
      if (ordersResult.total > 0) {
        messages.push(`${ordersResult.total} orders`)
      }

      toast.success('Dashboard updated', {
        description: messages.join(' • '),
      })

      router.refresh()
    } catch (error) {
      addProgress('error', `Error: ${getErrorMessage(error)}`)
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
    setProgressEvents([])
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
              <div className="space-y-4">
                <ProgressStream events={progressEvents} />
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing...</span>
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
                setProgressEvents([])
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
