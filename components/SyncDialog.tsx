'use client'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

import { useState, useEffect } from 'react'
import { api } from '@/lib/orpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import ProgressStream, { ProgressEvent } from './ProgressStream'

type ScanResult = {
  success: boolean
  summary: {
    conversationsProcessed: number
    conversationsAlreadyScanned: number
    shipmentsAdded: number
    shipmentsUpdated?: number
    shipmentsSkipped: number
    conversationsWithNoTracking: number
    batchSize: number
  }
  errors?: string[]
}

type SyncStatus = 'idle' | 'running' | 'success' | 'error'

export default function SyncDialog({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  
  const isDevMode = process.env.NODE_ENV === 'development'
  const [forceRescan, setForceRescan] = useState(false)
  
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const fallbackDate = threeDaysAgo.toISOString().split('T')[0]
  
  const [syncDate, setSyncDate] = useState(fallbackDate)
  const [duration, setDuration] = useState<string | null>(null)
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([])

  useEffect(() => {
    console.log('🔧 SyncDialog dev mode:', isDevMode, '| Force rescan available:', isDevMode)
  }, [])

  useEffect(() => {
    const fetchLastSync = async () => {
      try {
        const data = await api.syncHistory.get({ limit: 1 })
        
        if (data.success && data.lastSync && data.lastSync.startedAt) {
          const lastSyncDate = new Date(data.lastSync.startedAt)
          
          if (!isNaN(lastSyncDate.getTime())) {
            const defaultDate = lastSyncDate.toISOString().split('T')[0]
            setSyncDate(defaultDate)
          }
        }
      } catch (error) {
        console.error('Failed to fetch last sync date:', error)
      }
    }

    fetchLastSync()
  }, [])

  const addProgressEvent = (type: ProgressEvent['type'], message: string) => {
    setProgressEvents(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  const calculateDuration = (startTime: number): string => {
    const endTime = Date.now()
    const durationMs = endTime - startTime
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const handleSync = async () => {
    const startTime = Date.now()
    setStatus('running')
    setResult(null)
    setProgressEvents([])

    const formattedDate = new Date(syncDate).toLocaleDateString()
    addProgressEvent('processing', 'Initializing scan...')
    
    if (forceRescan && isDevMode) {
      addProgressEvent('processing', '🔄 DEV MODE: Force rescanning enabled - will update existing shipments')
    }
    
    addProgressEvent('processing', `Connecting to Front inbox...`)
    addProgressEvent('processing', `Scanning conversations from ${formattedDate}`)

    try {
      const data = await api.front.scan({
        after: syncDate,
        forceRescan: forceRescan && isDevMode,
      })

      setResult(data as unknown as ScanResult)
      
      const { summary } = data

      if (summary.conversationsProcessed > 0) {
        addProgressEvent('complete', `✓ Processed ${summary.conversationsProcessed} conversations`)
      }
      if (summary.conversationsAlreadyScanned > 0) {
        addProgressEvent('skipped', `↻ ${summary.conversationsAlreadyScanned} already scanned${forceRescan ? ' (but rescanned anyway)' : ' (saved AI credits!)'}`)
      }
      if (summary.shipmentsAdded > 0) {
        addProgressEvent('found', `📦 ${summary.shipmentsAdded} new shipments added!`)
      }
      if (summary.shipmentsUpdated && summary.shipmentsUpdated > 0) {
        addProgressEvent('found', `🔄 ${summary.shipmentsUpdated} existing shipments updated!`)
      }
      if (summary.shipmentsSkipped > 0) {
        addProgressEvent('skipped', `⊗ ${summary.shipmentsSkipped} duplicates skipped`)
      }
      if (summary.conversationsWithNoTracking > 0) {
        addProgressEvent('skipped', `∅ ${summary.conversationsWithNoTracking} had no tracking info`)
      }
      if (data.errors && data.errors.length > 0) {
        addProgressEvent('error', `⚠ ${data.errors.length} errors occurred`)
      }

      addProgressEvent('complete', '✓ Scan complete!')

      setDuration(calculateDuration(startTime))
      setStatus('success')

      const totalChanges = summary.shipmentsAdded + (summary.shipmentsUpdated || 0)
      if (totalChanges > 0) {
        toast.success(`Updated ${totalChanges} shipment(s)`, {
          description: summary.shipmentsUpdated 
            ? `${summary.shipmentsAdded} new, ${summary.shipmentsUpdated} updated`
            : `Processed ${summary.conversationsProcessed} conversations`,
        })
        onSuccess()
      } else {
        toast.info('No changes', {
          description: `Scanned ${summary.conversationsProcessed} conversations`,
        })
      }
    } catch (error: unknown) {
      console.error('Sync error:', error)
      addProgressEvent('error', `✗ Error: ${getErrorMessage(error)}`)
      setDuration(calculateDuration(startTime))
      setStatus('error')
      toast.error('An unexpected error occurred', {
        description: getErrorMessage(error) || 'Please try again later.',
      })
    }
  }

  const resetDialog = () => {
    setStatus('idle')
    setResult(null)
    setDuration(null)
    setProgressEvents([])
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4" />
          Scan for New Shipments
          {isDevMode && <span className="ml-1 text-xs opacity-70">[DEV]</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <DialogTitle>
              {status === 'idle' && 'Scan for New Shipments'}
              {status === 'running' && 'Scanning...'}
              {status === 'success' && 'Scan Complete'}
              {status === 'error' && 'Scan Failed'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {status === 'idle' && 'Scan Front inbox conversations to discover new tracking numbers'}
            {status === 'running' && 'Processing conversations and extracting tracking information...'}
            {status === 'success' && `Completed in ${(duration || "Calculating...")}`}
            {status === 'error' && 'An error occurred during scan'}
          </DialogDescription>
        </DialogHeader>

        {status === 'idle' && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="syncDate">Scan conversations from</Label>
              <Input
                id="syncDate"
                type="date"
                value={syncDate}
                onChange={(e) => setSyncDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                All conversations created on or after this date will be scanned
              </p>
            </div>

            {isDevMode && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="forceRescan"
                    checked={forceRescan}
                    onCheckedChange={(checked) => setForceRescan(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="forceRescan"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      🔄 Force rescan (Developer Mode)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Re-analyze conversations and <strong>update existing shipments</strong> with fresh data from emails.
                      <span className="block mt-1 text-orange-600 font-medium">
                        ⚠️ This will use AI credits for already-scanned conversations
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'running' && (
          <div className="space-y-4 py-2">
            <ProgressStream events={progressEvents} />
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </div>
          </div>
        )}

        {(status === 'success' || status === 'error') && result && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Conversations Scanned</p>
                <p className="text-2xl font-bold">{result.summary.conversationsProcessed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">New Shipments</p>
                <p className="text-2xl font-bold text-green-600">{result.summary.shipmentsAdded}</p>
              </div>
              {result.summary.shipmentsUpdated !== undefined && result.summary.shipmentsUpdated > 0 && (
                <div>
                  <p className="text-muted-foreground">Shipments Updated</p>
                  <p className="text-2xl font-bold text-blue-600">{result.summary.shipmentsUpdated}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Already Scanned</p>
                <p className="text-lg">{result.summary.conversationsAlreadyScanned}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duplicates Skipped</p>
                <p className="text-lg">{result.summary.shipmentsSkipped}</p>
              </div>
              <div>
                <p className="text-muted-foreground">No Tracking Info</p>
                <p className="text-lg">{result.summary.conversationsWithNoTracking}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="text-lg">{(duration || "Calculating...")}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      {result.errors.length} error(s) occurred
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700 max-h-32 overflow-y-auto">
                      <ul className="list-disc pl-5 space-y-1">
                        {result.errors.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>... and {result.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSync}>
                Start Scan
              </Button>
            </>
          )}
          {status === 'running' && (
            <Button disabled>
              <Loader2 className="animate-spin" />
              Scanning...
            </Button>
          )}
          {(status === 'success' || status === 'error') && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                Scan Again
              </Button>
              <Button onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
