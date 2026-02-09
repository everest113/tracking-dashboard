'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react'

export type ProgressEvent = {
  type: 'processing' | 'found' | 'skipped' | 'error' | 'complete'
  message: string
  timestamp: number
}

type ProgressStreamProps = {
  events: ProgressEvent[]
}

export default function ProgressStream({ events }: ProgressStreamProps) {
  const streamRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest event
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [events])

  const getIcon = (type: ProgressEvent['type']) => {
    switch (type) {
      case 'processing':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
      case 'found':
        return <Package className="h-3.5 w-3.5 text-green-500" />
      case 'skipped':
        return <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      case 'complete':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    }
  }

  const getTextColor = (type: ProgressEvent['type']) => {
    switch (type) {
      case 'processing':
        return 'text-blue-600'
      case 'found':
        return 'text-green-600'
      case 'skipped':
        return 'text-gray-500'
      case 'error':
        return 'text-red-600'
      case 'complete':
        return 'text-green-600'
    }
  }

  return (
    <div className="relative h-[150px] overflow-hidden rounded-lg bg-muted/30">
      {/* Blur gradient overlay on edges */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background/90 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/90 to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling stream - no scrollbar */}
      <div
        ref={streamRef}
        className="h-full overflow-y-auto overflow-x-hidden scroll-smooth px-4 py-3 scrollbar-none"
      >
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Initializing sync...
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={index}
                className={`flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 ${getTextColor(event.type)}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">
                    {event.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Hide scrollbar completely */}
      <style jsx>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
