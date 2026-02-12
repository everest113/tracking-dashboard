'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/orpc/client'

export default function StaleDataBanner() {
  const router = useRouter()
  const [isStale, setIsStale] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const checkStaleData = useCallback(async () => {
    try {
      // Check both sync history AND shipment updates
      const [shipmentsData, syncData] = await Promise.all([
        api.shipments.list({ pagination: { page: 1, pageSize: 50 } }),
        api.syncHistory.get({ limit: 1 }),
      ])

      let mostRecentUpdate: Date | null = null

      // Check most recent ship24LastUpdate from shipments
      if (shipmentsData.items.length > 0) {
        for (const shipment of shipmentsData.items) {
          if (shipment.ship24LastUpdate) {
            const updateTime = new Date(shipment.ship24LastUpdate)
            if (!mostRecentUpdate || updateTime > mostRecentUpdate) {
              mostRecentUpdate = updateTime
            }
          }
        }
      }

      // Also check sync history (Front scan completion time)
      if (syncData.lastSync?.completedAt) {
        const syncTime = new Date(syncData.lastSync.completedAt)
        if (!mostRecentUpdate || syncTime > mostRecentUpdate) {
          mostRecentUpdate = syncTime
        }
      }

      if (mostRecentUpdate) {
        setLastUpdate(mostRecentUpdate)
        
        // Check if last update was more than 36 hours ago
        const thirtySixHoursAgo = new Date()
        thirtySixHoursAgo.setHours(thirtySixHoursAgo.getHours() - 36)
        
        setIsStale(mostRecentUpdate < thirtySixHoursAgo)
      } else {
        // No data at all - consider it stale
        setIsStale(true)
        setLastUpdate(null)
      }
    } catch (error) {
      console.error('Failed to check stale data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStaleData()
  }, [checkStaleData])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.manualUpdateTracking.update()
      router.refresh()
      await checkStaleData()
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading || !isStale || !lastUpdate) {
    return null
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200 mb-6">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm text-yellow-800">
          Data may be stale. Last synced {formatDistanceToNow(lastUpdate, { addSuffix: true })}. 
          Click refresh to pull the latest tracking updates.
        </span>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-4 border-yellow-300 bg-white hover:bg-yellow-100 text-yellow-800 hover:text-yellow-900"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Refresh Now
        </Button>
      </AlertDescription>
    </Alert>
  )
}
