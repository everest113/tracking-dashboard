'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { api } from '@/lib/orpc/client'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actor: string
  metadata: Record<string, unknown>
  status: string
  error: string | null
  createdAt: string
}

interface AuditTimelineProps {
  entityType: string
  entityId: string
  /** Filter to specific action type */
  action?: string
  /** Maximum entries to show initially */
  limit?: number
  /** Title for the timeline section */
  title?: string
  /** Show compact view */
  compact?: boolean
  /** CSS class for the container */
  className?: string
}

/**
 * Reusable component for displaying audit history for any entity.
 * Shows a timeline of actions with status indicators and metadata.
 */
export default function AuditTimeline({
  entityType,
  entityId,
  action,
  limit = 10,
  title = 'Activity History',
  compact = false,
  className,
}: AuditTimelineProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, action, limit])

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.audit.getHistory({
        entityType,
        entityId,
        action,
        limit,
        offset: 0,
      })
      setEntries(result.entries)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'skipped':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // Human-readable labels for audit actions
  const actionLabels: Record<string, string> = {
    // Order actions
    'order.synced': 'Synced from OMG',
    'order.created': 'Order Created',
    'order.refreshed': 'Refreshed from OMG',
    'order.status_changed': 'Status Changed',
    // Shipment actions
    'shipment.created': 'Shipment Created',
    'shipment.status_changed': 'Tracking Update',
    'shipment.tracker_registered': 'Tracker Registered',
    'shipment.tracker_failed': 'Tracker Failed',
    // Thread actions
    'thread.searched': 'Thread Search',
    'thread.auto_matched': 'Auto-Matched Thread',
    'thread.manually_linked': 'Manually Linked Thread',
    'thread.rejected': 'Thread Rejected',
    'thread.no_match': 'No Thread Found',
    'thread.cleared': 'Thread Unlinked',
    // Notification actions
    'notification.sent': 'Notification Sent',
    'notification.failed': 'Notification Failed',
    'notification.skipped': 'Notification Skipped',
    // Sync actions
    'omg.sync_completed': 'OMG Sync Complete',
    'omg.sync_failed': 'OMG Sync Failed',
  }

  const formatAction = (action: string) => {
    // Check for explicit label first
    if (actionLabels[action]) {
      return actionLabels[action]
    }
    // Fallback: Convert 'notification.sent' to 'Notification Sent'
    return action
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/_/g, ' ')
  }

  const formatMetadataKey = (key: string) => {
    // Convert 'conversationId' to 'Conversation ID'
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, ' ')
  }

  const formatMetadataValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Activity className="h-4 w-4" />
          {title}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-md bg-red-50 border border-red-200 p-3', className)}>
        <div className="flex items-center gap-2 text-sm text-red-700">
          <XCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={cn('text-center py-6 text-muted-foreground text-sm', className)}>
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No activity recorded yet
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Activity className="h-4 w-4" />
          {title}
        </div>
        {total > limit && (
          <span className="text-xs text-muted-foreground">
            Showing {entries.length} of {total}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {entries.map((entry) => {
            const isExpanded = expandedEntries.has(entry.id)
            const hasMetadata = Object.keys(entry.metadata).length > 0

            return (
              <div key={entry.id} className="relative pl-6">
                {/* Status dot */}
                <div className="absolute left-0 top-0.5">
                  {getStatusIcon(entry.status)}
                </div>

                {compact ? (
                  // Compact view
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {formatAction(entry.action)}
                      </span>
                      <Badge variant={getStatusBadgeVariant(entry.status)} className="text-[10px]">
                        {entry.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ) : (
                  // Full view
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(entry.id)}>
                    <div className="space-y-1">
                      {/* Action header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatAction(entry.action)}
                            </span>
                            <Badge
                              variant={getStatusBadgeVariant(entry.status)}
                              className="text-[10px]"
                            >
                              {entry.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>by {entry.actor}</span>
                            <span>•</span>
                            <span
                              title={format(new Date(entry.createdAt), 'PPpp')}
                            >
                              {formatDistanceToNow(new Date(entry.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        {(hasMetadata || entry.error) && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>

                      {/* Error message (always visible if present) */}
                      {entry.error && (
                        <div className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700">
                          {entry.error}
                        </div>
                      )}

                      {/* Expandable metadata */}
                      {hasMetadata && (
                        <CollapsibleContent>
                          <div className="mt-2 rounded bg-muted/50 p-2 text-xs space-y-1">
                            {Object.entries(entry.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                  {formatMetadataKey(key)}
                                </span>
                                <span className="font-mono truncate max-w-[200px]" title={formatMetadataValue(value)}>
                                  {formatMetadataValue(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Load more */}
      {total > entries.length && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const result = await api.audit.getHistory({
                  entityType,
                  entityId,
                  action,
                  limit: entries.length + limit,
                  offset: 0,
                })
                setEntries(result.entries)
              } catch (err) {
                console.error('Failed to load more:', err)
              }
            }}
          >
            Load more ({total - entries.length} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}
