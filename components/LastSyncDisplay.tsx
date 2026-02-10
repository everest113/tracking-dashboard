'use client'

import { useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { formatDistanceToNow } from 'date-fns'
import SyncHistoryDialog from './SyncHistoryDialog'
import { Button } from './ui/button'
import { History } from 'lucide-react'

interface SyncHistory {
  id: number
  started_at: string
  completed_at: string | null
  conversations_processed: number
  shipments_added: number
}

export default function LastSyncDisplay() {
  const [lastSync, setLastSync] = useState<SyncHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetchLastSync()
  }, [])

  const fetchLastSync = async () => {
    try {
      const response = await fetch('/api/sync-history?limit=1')
      const data: unknown = await response.json()

      if (response.ok && data && typeof data === 'object' && 'lastSync' in data) {
        setLastSync(data.lastSync as SyncHistory)
      }
    } catch (error) {
      console.error('Failed to fetch last sync:', getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

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
            Last sync: {formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true })}
            {lastSync.shipments_added > 0 && ` (${lastSync.shipments_added} added)`}
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
}
