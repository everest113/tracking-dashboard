'use client'

import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { formatDistanceToNow } from 'date-fns'
import SyncHistoryDialog from './SyncHistoryDialog'
import { Button } from './ui/button'
import { History } from 'lucide-react'
import { api } from '@/lib/orpc/client'

interface SyncHistory {
  id: number
  startedAt: Date
  completedAt: Date | null
  conversationsProcessed: number
  shipmentsAdded: number
  status: string
  errors: unknown[]
}

export interface LastSyncDisplayRef {
  refresh: () => Promise<void>
}

const LastSyncDisplay = forwardRef<LastSyncDisplayRef>((props, ref) => {
  const [lastSync, setLastSync] = useState<SyncHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const fetchLastSync = async () => {
    try {
      const data = await api.syncHistory.get({ limit: 1 })
      if (data.lastSync) {
        setLastSync(data.lastSync as SyncHistory)
      }
    } catch (error) {
      console.error('Failed to fetch last sync:', getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLastSync()
  }, [])
  
  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchLastSync
  }))

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory(true)}
        className="text-sm text-muted-foreground hover:text-foreground h-auto px-2 py-1 flex items-center gap-1.5"
      >
        <History className="h-3.5 w-3.5" />
        {lastSync ? (
          <>
            Last sync: {formatDistanceToNow(new Date(lastSync.startedAt), { addSuffix: true })}
            {lastSync.shipmentsAdded > 0 && ` (${lastSync.shipmentsAdded} added)`}
          </>
        ) : (
          'No sync history'
        )}
      </Button>
      
      <SyncHistoryDialog 
        isOpen={showHistory} 
        onClose={() => {
          setShowHistory(false)
          // Refresh sync data when dialog closes
          fetchLastSync()
        }}
      />
    </>
  )
})

LastSyncDisplay.displayName = 'LastSyncDisplay'

export default LastSyncDisplay
