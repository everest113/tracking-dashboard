'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  Link2,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Mail,
  Package,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/orpc/client'
import { cn } from '@/lib/utils'

interface PendingReviewItem {
  threadLink: {
    id: number
    shipmentId: number
    frontConversationId: string
    confidenceScore: number
    matchStatus: 'pending_review' | 'not_found' | 'not_discovered' | string
    emailMatched: boolean
    orderInSubject: boolean
    orderInBody: boolean
    daysSinceLastMessage: number | null
    matchedEmail: string | null
    conversationSubject: string | null
  }
  shipment: {
    id: number
    poNumber: string | null
    trackingNumber: string
    carrier: string | null
    status: string
  }
  customerEmail: string | null
  customerName: string | null
}

interface Conversation {
  id: string
  subject: string | null
  createdAt: string
  recipientEmail: string | null
}

export default function ThreadReviewQueue() {
  const [items, setItems] = useState<PendingReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  
  // Manual link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkingItem, setLinkingItem] = useState<PendingReviewItem | null>(null)
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState<Conversation[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const fetchPendingReviews = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.customerThread.getPendingReviews({ limit: 50 })
      setItems(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending reviews')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleApprove = async (item: PendingReviewItem) => {
    setActionLoading(item.shipment.id)
    try {
      await api.customerThread.approve({ shipmentId: item.shipment.id })
      // Remove from list
      setItems((prev) => prev.filter((i) => i.shipment.id !== item.shipment.id))
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (item: PendingReviewItem) => {
    setActionLoading(item.shipment.id)
    try {
      await api.customerThread.reject({ shipmentId: item.shipment.id })
      // Remove from list
      setItems((prev) => prev.filter((i) => i.shipment.id !== item.shipment.id))
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const openLinkDialog = (item: PendingReviewItem) => {
    setLinkingItem(item)
    setSearchEmail(item.customerEmail ?? '')
    setSearchResults([])
    setLinkDialogOpen(true)
  }

  /**
   * Handle search/link button click:
   * 1. For not_discovered: trigger auto-discovery first
   * 2. If discovery finds something (linked/pending), refresh list
   * 3. If discovery fails (not_found), open manual link dialog
   */
  const handleSearchOrLink = async (item: PendingReviewItem) => {
    // If already has a candidate (pending_review), go straight to link dialog
    if (item.threadLink.matchStatus === 'pending_review') {
      openLinkDialog(item)
      return
    }

    // For not_discovered or not_found, try auto-discovery first
    setActionLoading(item.shipment.id)
    try {
      const result = await api.customerThread.triggerDiscovery({ 
        shipmentId: item.shipment.id 
      })

      if (result.status === 'linked') {
        // Auto-matched! Remove from list and show success
        setItems((prev) => prev.filter((i) => i.shipment.id !== item.shipment.id))
        // Could add a toast here
      } else if (result.status === 'pending_review') {
        // Found candidates - refresh to show updated item with candidates
        await fetchPendingReviews()
      } else if (result.status === 'already_linked') {
        // Already linked - just remove from list
        setItems((prev) => prev.filter((i) => i.shipment.id !== item.shipment.id))
      } else {
        // not_found - open manual link dialog
        // Update the item's status first so UI reflects the change
        setItems((prev) => prev.map((i) => 
          i.shipment.id === item.shipment.id 
            ? { ...i, threadLink: { ...i.threadLink, matchStatus: 'not_found' as const } }
            : i
        ))
        openLinkDialog(item)
      }
    } catch (err) {
      console.error('Failed to discover thread:', err)
      // On error, fall back to manual link dialog
      openLinkDialog(item)
    } finally {
      setActionLoading(null)
    }
  }

  const searchConversations = async () => {
    if (!searchEmail) return
    setSearching(true)
    try {
      const result = await api.customerThread.searchConversations({ email: searchEmail })
      setSearchResults(result.conversations)
    } catch (err) {
      console.error('Failed to search:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleLinkDifferent = async (conversationId: string) => {
    if (!linkingItem) return
    setActionLoading(linkingItem.shipment.id)
    try {
      await api.customerThread.linkDifferent({
        shipmentId: linkingItem.shipment.id,
        newConversationId: conversationId,
      })
      // Remove from list
      setItems((prev) => prev.filter((i) => i.shipment.id !== linkingItem.shipment.id))
      setLinkDialogOpen(false)
      setLinkingItem(null)
    } catch (err) {
      console.error('Failed to link:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const getConfidenceBadge = (score: number) => {
    const percent = Math.round(score * 100)
    if (score >= 0.7) {
      return <Badge variant="default" className="bg-green-500">{percent}%</Badge>
    } else if (score >= 0.5) {
      return <Badge variant="default" className="bg-yellow-500">{percent}%</Badge>
    } else {
      return <Badge variant="secondary">{percent}%</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Thread Review Queue</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchPendingReviews}>
          Retry
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-medium">All caught up!</h3>
        <p className="text-sm">No pending thread matches to review.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Thread Review Queue</h2>
          <Badge variant="secondary">{items.length} pending</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPendingReviews}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Shipment</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Matched Thread</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isExpanded = expandedRows.has(item.shipment.id)
            const isLoading = actionLoading === item.shipment.id

            return (
              <Collapsible key={item.shipment.id} asChild open={isExpanded}>
                <>
                  <TableRow className={cn(isExpanded && 'bg-muted/50')}>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleExpanded(item.shipment.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {item.shipment.poNumber ?? item.shipment.trackingNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.shipment.carrier} • {item.shipment.status}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{item.customerName ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.customerEmail ?? 'No email'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.threadLink.matchStatus === 'not_found' ? (
                        <span className="text-muted-foreground italic">No thread found</span>
                      ) : item.threadLink.matchStatus === 'not_discovered' ? (
                        <span className="text-muted-foreground italic">Not yet searched</span>
                      ) : (
                        <div className="max-w-[200px] truncate" title={item.threadLink.conversationSubject ?? ''}>
                          {item.threadLink.conversationSubject ?? 'No subject'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.threadLink.matchStatus === 'not_found' ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Not Found
                        </Badge>
                      ) : item.threadLink.matchStatus === 'not_discovered' ? (
                        <Badge variant="outline" className="text-gray-500 border-gray-300">
                          Not Searched
                        </Badge>
                      ) : (
                        getConfidenceBadge(item.threadLink.confidenceScore)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Only show Approve/Reject if there's a candidate to review */}
                        {item.threadLink.matchStatus === 'pending_review' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(item)}
                              disabled={isLoading}
                              title="Approve"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(item)}
                              disabled={isLoading}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleSearchOrLink(item)}
                          disabled={isLoading}
                          title={
                            item.threadLink.matchStatus === 'not_discovered' 
                              ? 'Auto-search & Link Thread' 
                              : item.threadLink.matchStatus === 'not_found' 
                                ? 'Search Again or Link Manually' 
                                : 'Link Different Thread'
                          }
                        >
                          {item.threadLink.matchStatus === 'not_discovered' ? (
                            <Search className="h-4 w-4" />
                          ) : item.threadLink.matchStatus === 'not_found' ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6}>
                        <div className="py-2 px-4">
                          <h4 className="text-sm font-medium mb-2">Confidence Breakdown</h4>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Email Match:</span>{' '}
                              {item.threadLink.emailMatched ? (
                                <Badge variant="default" className="bg-green-500 ml-1">Yes</Badge>
                              ) : (
                                <Badge variant="secondary" className="ml-1">No</Badge>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Order in Subject:</span>{' '}
                              {item.threadLink.orderInSubject ? (
                                <Badge variant="default" className="bg-green-500 ml-1">Yes</Badge>
                              ) : (
                                <Badge variant="secondary" className="ml-1">No</Badge>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Order in Body:</span>{' '}
                              {item.threadLink.orderInBody ? (
                                <Badge variant="default" className="bg-green-500 ml-1">Yes</Badge>
                              ) : (
                                <Badge variant="secondary" className="ml-1">No</Badge>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Days Since Message:</span>{' '}
                              <span className="ml-1">
                                {item.threadLink.daysSinceLastMessage ?? '—'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Conversation ID: {item.threadLink.frontConversationId}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            )
          })}
        </TableBody>
      </Table>

      {/* Manual Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link to Different Conversation</DialogTitle>
            <DialogDescription>
              Search for a conversation to link to shipment{' '}
              <strong>{linkingItem?.shipment.poNumber ?? linkingItem?.shipment.trackingNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchConversations()}
              />
              <Button onClick={searchConversations} disabled={searching}>
                <Search className="h-4 w-4 mr-1" />
                Search
              </Button>
            </div>

            {searching && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="border rounded-md max-h-[300px] overflow-auto">
                {searchResults.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleLinkDifferent(conv.id)}
                  >
                    <div>
                      <div className="font-medium">{conv.subject ?? 'No subject'}</div>
                      <div className="text-xs text-muted-foreground">
                        {conv.recipientEmail} •{' '}
                        {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchResults.length === 0 && searchEmail && (
              <div className="text-center py-6 text-muted-foreground">
                No conversations found for this email.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
