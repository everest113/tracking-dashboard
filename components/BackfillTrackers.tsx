'use client'

import { useState } from 'react'
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

export default function BackfillTrackers() {
  const [isOpen, setIsOpen] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)

  const handleBackfill = async () => {
    setIsBackfilling(true)

    try {
      const response = await fetch('/api/trackers/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error('Backfill failed', {
          description: data.error || 'Failed to register trackers',
        })
        return
      }

      if (data.registered === 0) {
        toast.success('Already up to date', {
          description: 'All shipments are already registered with Ship24.',
        })
      } else {
        toast.success('Trackers registered', {
          description: `${data.registered} shipment(s) registered with Ship24 for real-time tracking.`,
        })
      }

      setIsOpen(false)
    } catch (error: any) {
      toast.error('Backfill failed', {
        description: error.message || 'An unexpected error occurred.',
      })
    } finally {
      setIsBackfilling(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Register Trackers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Register Ship24 Trackers</DialogTitle>
          <DialogDescription>
            Register all existing shipments with Ship24 to receive real-time webhook updates.
            <br /><br />
            This only affects shipments that haven't been registered yet. New shipments are registered automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-medium mb-2">What this does:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Registers untracked shipments with Ship24</li>
              <li>Enables real-time webhook notifications</li>
              <li>Improves tracking update efficiency</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isBackfilling}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="flex-1"
            >
              {isBackfilling ? 'Registering...' : 'Register Now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
