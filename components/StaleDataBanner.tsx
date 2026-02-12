'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/orpc/client'

interface StaleDataBannerProps {
  onRefresh: () => void
}

export default function StaleDataBanner({ onRefresh }: StaleDataBannerProps) {
  const [isStale, setIsStale] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkStaleData()
  }, [])

  const checkStaleData = async () => {
    try {
      // Fetch the most recent ship24LastUpdate from all shipments
      const data = await api.shipments.list({
        pagination: { page: 1, pageSize: 1 },
        sort: { field: 'updatedAt', direction: 'desc' },
      })

      if (data.items.length > 0) {
        const mostRecentShipment = data.items[0]
        const lastUpdateTime = mostRecentShipment.ship24LastUpdate 
          ? new Date(mostRecentShipment.ship24LastUpdate)
          : mostRecentShipment.updatedAt 
          ? new Date(mostRecentShipment.updatedAt)
          : null

        if (lastUpdateTime) {
          setLastUpdate(lastUpdateTime)
          
          // Check if last update was more than 36 hours ago
          const thirtySixHoursAgo = new Date()
          thirtySixHoursAgo.setHours(thirtySixHoursAgo.getHours() - 36)
          
          if (lastUpdateTime < thirtySixHoursAgo) {
            setIsStale(true)
          }
        }
      }
    } catch (error) {
      console.error('Failed to check stale data:', error)
    } finally {
      setLoading(false)
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
          onClick={onRefresh}
          className="ml-4 border-yellow-300 bg-white hover:bg-yellow-100 text-yellow-800 hover:text-yellow-900"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh Now
        </Button>
      </AlertDescription>
    </Alert>
  )
}
