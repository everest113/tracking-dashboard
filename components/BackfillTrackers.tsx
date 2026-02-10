'use client'

import { useState } from 'react'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload } from 'lucide-react'

export default function BackfillTrackers({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)

  const handleBackfill = async () => {
    setIsBackfilling(true)

    try {
      const response = await fetch('/api/trackers/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data: unknown = await response.json()

      if (!response.ok) {
        const errorMsg = typeof data === 'object' && data !== null && 'error' in data 
          ? String((data as { error: string }).error)
          : 'Failed to register trackers'
        toast.error('Update failed', {
          description: errorMsg,
        })
        return
      }

      const result = data as { registered: number; skipped: number }

      if (result.registered === 0) {
        toast.success('Already up to date', {
          description: 'All shipments are already being tracked.',
        })
      } else {
        toast.success('Shipments updated', {
          description: `${result.registered} shipment(s) registered for real-time tracking.`,
        })
      }

      setIsOpen(false)
      onSuccess()
    } catch (error: unknown) {
      toast.error('Update failed', {
        description: getErrorMessage(error) || 'An unexpected error occurred.',
      })
    } finally {
      setIsBackfilling(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" />
          Update Shipment Statuses
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Shipment Statuses</DialogTitle>
          <DialogDescription>
            Enable real-time tracking for shipments that aren&apos;t being monitored yet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will find all untracked shipments and register them with Ship24 for automatic status updates.
          </p>
          <Button
            onClick={handleBackfill}
            disabled={isBackfilling}
            className="w-full"
          >
            {isBackfilling ? 'Updating...' : 'Update Statuses'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
