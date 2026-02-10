'use client'

import { useState, useEffect } from 'react'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'

interface SyncRecord {
  id: number
  source: string
  conversations_processed: number
  conversations_already_scanned: number
  shipments_added: number
  shipments_skipped: number
  conversations_with_no_tracking: number
  duration_ms: number | null
  errors: string[]
  status: string
  started_at: string
  completed_at: string | null
}

interface SyncHistoryDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function SyncHistoryDialog({ isOpen, onClose }: SyncHistoryDialogProps) {
  const [history, setHistory] = useState<SyncRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sync-history?limit=20')
      const data = await response.json()

      if (data.success) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to fetch sync history:', getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const getStatusIcon = (status: string, errorsCount: number) => {
    if (status === 'error' || errorsCount > 0) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Front Import History</DialogTitle>
          <DialogDescription>
            History of manual Front inbox syncs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync history found
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record.status, record.errors.length)}
                    <div>
                      <div className="font-medium">
                        {format(new Date(record.started_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(record.started_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(record.duration_ms)}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Processed</div>
                    <div className="font-semibold">{record.conversations_processed}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Added</div>
                    <div className="font-semibold text-green-600">
                      {record.shipments_added}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Skipped</div>
                    <div className="font-semibold text-gray-500">
                      {record.shipments_skipped}
                    </div>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Already scanned: {record.conversations_already_scanned}</span>
                  <span>No tracking: {record.conversations_with_no_tracking}</span>
                </div>

                {/* Errors */}
                {record.errors.length > 0 && (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs space-y-1 flex-1">
                        <div className="font-medium text-yellow-800">
                          {record.errors.length} error(s) occurred
                        </div>
                        <div className="text-yellow-700 max-h-20 overflow-y-auto">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {record.errors.slice(0, 3).map((error, i) => (
                              <li key={i} className="break-words">{error}</li>
                            ))}
                            {record.errors.length > 3 && (
                              <li>... and {record.errors.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
