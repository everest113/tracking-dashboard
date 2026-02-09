'use client'

import { useState, useEffect } from 'react'
import ShipmentTable from '@/components/ShipmentTable'
import LastSyncDisplay from '@/components/LastSyncDisplay'
import ManualTrackingUpdate from '@/components/ManualTrackingUpdate'
import BackfillTrackers from '@/components/BackfillTrackers'


interface Shipment {
  id: number
  tracking_number: string
  carrier: string | null
  status: string
  po_number: string | null
  supplier: string | null
  last_checked: string | null
  created_at: string
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const response = await fetch('/api/shipments')
        const data = await response.json()
        setShipments(data)
      } catch (error) {
        console.error('Failed to fetch shipments:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchShipments()
  }, [refreshKey])
  
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Shipment Tracking Dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Monitor all shipments and tracking status
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <LastSyncDisplay />
              <div className="flex gap-2">
                <BackfillTrackers onSuccess={handleRefresh} />
                <ManualTrackingUpdate onSuccess={handleRefresh} />
              </div>
            </div>
          </div>
        </div>

        {loading ? <p>Loading...</p> : <ShipmentTable shipments={shipments} />}
      </div>
    </main>
  )
}
