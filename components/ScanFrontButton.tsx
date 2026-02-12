'use client'

import { useState } from 'react'
import { getErrorMessage } from '@/lib/types/api-responses'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/orpc/client'

type ScanResult = {
  success: boolean
  summary: {
    conversationsProcessed: number
    shipmentsAdded: number
    shipmentsSkipped: number
    conversationsWithNoTracking: number
  }
  errors?: string[]
}

export default function ScanFrontButton({ onSuccess }: { onSuccess: () => void }) {
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = async () => {
    setIsScanning(true)

    try {
      const data = await api.front.scan({ batchSize: 50 })
      const { summary } = data

      // Show summary toast
      if (summary.shipmentsAdded > 0) {
        toast.success(`Found ${summary.shipmentsAdded} new shipment(s)`, {
          description: `Scanned ${summary.conversationsProcessed} conversations. Skipped ${summary.shipmentsSkipped} duplicates.`,
        })
        onSuccess()
      } else if (summary.conversationsProcessed > 0) {
        toast.info('No new shipments found', {
          description: `Scanned ${summary.conversationsProcessed} conversations. ${summary.conversationsWithNoTracking} had no tracking info.`,
        })
      } else {
        toast.info('No conversations to scan', {
          description: 'The Suppliers inbox appears to be empty.',
        })
      }

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        console.error('Scan errors:', data.errors)
        toast.warning('Some conversations failed to process', {
          description: `${data.errors.length} error(s) occurred. Check console for details.`,
        })
      }
    } catch (error: unknown) {
      console.error('Scan error:', error)
      toast.error('An unexpected error occurred', {
        description: getErrorMessage(error) || 'Please try again later.',
      })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleScan}
      disabled={isScanning}
    >
      {isScanning ? (
        <>
          <Loader2 className="animate-spin" />
          Scanning...
        </>
      ) : (
        'Scan Front Inbox'
      )}
    </Button>
  )
}
