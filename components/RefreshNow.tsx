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

  const isDevMode = process.env.NODE_ENV === 'development'

  useEffect(() => {
    if (showDialog) {
      // Reset state when dialog opens
      setProgress([])
      setShowAdvanced(false)
    }
  }, [showDialog])

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
    setShowDialog(true)
    setProgress([])

    try {
      // Step 1: Scan Front inbox for new shipments
      addProgress('🔍 Scanning Front inbox for new tracking numbers...')
      const startDate = await getStartDate()
      const formattedDate = new Date(startDate).toLocaleDateString()
      addProgress(`📅 Checking conversations from ${formattedDate}`)

      const scanResult = await api.front.scan({
        after: startDate,
        forceRescan: forceRescan && isDevMode,
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

  return (
    <>
      <Button onClick={handleRefresh} disabled={loading} variant="default">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Refreshing...' : 'Refresh Now'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Refreshing Dashboard...' : 'Refresh Complete'}
            </DialogTitle>
            <DialogDescription>
              {loading ? 'Scanning for new shipments and updating statuses' : 'Dashboard has been updated'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Progress log */}
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

            {/* Advanced configuration */}
            {!loading && (
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

                    {isDevMode && (
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
                            Force rescan (Dev Mode)
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
            )}
          </div>

          {!loading && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Close
              </Button>
              <Button onClick={handleRefresh}>
                Refresh Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
