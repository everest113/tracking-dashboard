'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Clock, History, ChevronRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SyncHistory = {
  id: number
  conversationsProcessed: number
  conversationsAlreadyScanned: number
  shipmentsAdded: number
  shipmentsSkipped: number
  conversationsWithNoTracking: number
  batchSize: number
  limit: number
  status: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  errors: string[]
}

type SyncData = {
  lastSync: SyncHistory | null
  history: SyncHistory[]
}

export default function LastSyncDisplay() {
  const [syncData, setSyncData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  const fetchSyncHistory = async () => {
    try {
      const response = await fetch('/api/sync-history?limit=20')
      const data = await response.json()
      if (data.success) {
        setSyncData(data)
      }
    } catch (error) {
      console.error('Error fetching sync history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSyncHistory()
  }, [])

  // Refresh when sheet opens
  useEffect(() => {
    if (isOpen) {
      fetchSyncHistory()
    }
  }, [isOpen])

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 hover:bg-green-100'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
      case 'failed':
        return 'bg-red-100 text-red-800 hover:bg-red-100'
      case 'running':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!syncData?.lastSync) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Never synced</span>
      </div>
    )
  }

  const { lastSync, history } = syncData

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            Last synced{' '}
            {lastSync.completedAt && (
              <span className="font-medium">
                {formatDistanceToNow(new Date(lastSync.completedAt), { addSuffix: true })}
              </span>
            )}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sync History
          </SheetTitle>
          <SheetDescription>
            View all recent sync operations and their results
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync history available
            </div>
          ) : (
            history.map((sync) => (
              <div
                key={sync.id}
                className="rounded-lg border p-4 space-y-3 hover:bg-muted/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className={getStatusColor(sync.status)}
                  >
                    {sync.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(sync.startedAt)}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Conversations</p>
                    <p className="text-lg font-semibold">{sync.conversationsProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">New Shipments</p>
                    <p className="text-lg font-semibold text-green-600">{sync.shipmentsAdded}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Already Scanned</p>
                    <p className="font-medium">{sync.conversationsAlreadyScanned}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duplicates Skipped</p>
                    <p className="font-medium">{sync.shipmentsSkipped}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Limit: {sync.limit} conversations</span>
                  <span>Duration: {formatDuration(sync.durationMs)}</span>
                </div>

                {/* Errors */}
                {sync.errors && sync.errors.length > 0 && (
                  <div className="rounded bg-red-50 p-3 text-xs">
                    <p className="font-medium text-red-800 mb-1">
                      {sync.errors.length} error(s)
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-red-700 max-h-20 overflow-y-auto">
                      {sync.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {sync.errors.length > 3 && (
                        <li>... and {sync.errors.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
