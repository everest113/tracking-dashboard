'use client'

import { useState, useEffect } from 'react'
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
  ExternalLink,
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
import { toast } from 'sonner'

interface OrderReviewItem {
  order: {
    orderNumber: string
    orderName: string | null
    customerName: string | null
    customerEmail: string | null
    shipmentCount: number
    computedStatus: string
  }
  thread: {
    orderNumber: string
    frontConversationId: string | null
    matchStatus: 'pending_review' | 'not_found' | 'auto_matched' | 'manually_linked' | 'rejected'
    confidenceScore: number | null
    emailMatched: boolean
    orderInSubject: boolean
    orderInBody: boolean
    daysSinceLastMessage: number | null
    matchedEmail: string | null
    conversationSubject: string | null
    reviewedAt: string | null
    reviewedBy: string | null
  }
}

interface Conversation {
  id: string
  subject: string | null
  createdAt: string
  recipientEmail: string | null
}

export default function ThreadReviewQueue() {
  const [items, setItems] = useState<OrderReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Manual link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkingItem, setLinkingItem] = useState<OrderReviewItem | null>(null)
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

  const toggleExpanded = (orderNumber: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(orderNumber)) {
        next.delete(orderNumber)
      } else {
        next.add(orderNumber)
      }
      return next
    })
  }

  const handleApprove = async (item: OrderReviewItem) => {
    setActionLoading(item.order.orderNumber)
    try {
      await api.customerThread.approve({ orderNumber: item.order.orderNumber })
      toast.success('Thread approved', {
        description: `Linked to conversation`,
        action: item.thread.frontConversationId ? {
          label: 'Open in Front',
          onClick: () => window.open(`https://app.frontapp.com/open/${item.thread.frontConversationId}`, '_blank'),
        } : undefined,
      })
      fetchPendingReviews()
    } catch (err) {
      toast.error('Failed to approve', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (item: OrderReviewItem) => {
    setActionLoading(item.order.orderNumber)
    try {
      await api.customerThread.reject({ orderNumber: item.order.orderNumber })
      toast.success('Thread rejected')
      fetchPendingReviews()
    } catch (err) {
      toast.error('Failed to reject', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSearch = async (item: OrderReviewItem) => {
    // If it's a not_found item, trigger discovery first
    if (item.thread.matchStatus === 'not_found') {
      setActionLoading(item.order.orderNumber)
      try {
        const result = await api.customerThread.triggerDiscovery({
          orderNumber: item.order.orderNumber,
        })
        
        if (result.status === 'linked') {
          toast.success('Thread found!', {
            description: `Auto-matched with ${Math.round((result.topScore ?? 0) * 100)}% confidence`,
          })
          fetchPendingReviews()
          return
        } else if (result.status === 'pending_review') {
          toast.info('Candidates found', {
            description: `${result.candidatesFound} candidate(s) found. Review below.`,
          })
          fetchPendingReviews()
          return
        } else {
          // Open manual link dialog
          setLinkingItem(item)
          setSearchEmail(item.order.customerEmail || '')
          setLinkDialogOpen(true)
        }
      } catch (err) {
        toast.error('Discovery failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        setActionLoading(null)
      }
    } else {
      // Open manual link dialog for pending_review items
      setLinkingItem(item)
      setSearchEmail(item.order.customerEmail || '')
      setLinkDialogOpen(true)
    }
  }

  const searchConversations = async () => {
    if (!searchEmail.trim()) return
    
    // Check if it's a conversation ID
    if (searchEmail.startsWith('cnv_')) {
      // Direct link by ID
      handleLinkDifferent(searchEmail)
      return
    }
    
    setSearching(true)
    try {
      const result = await api.customerThread.searchConversations({ email: searchEmail })
      setSearchResults(result.conversations)
    } catch (err) {
      toast.error('Search failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleLinkDifferent = async (conversationId: string) => {
    if (!linkingItem) return
    
    setSearching(true)
    try {
      await api.customerThread.linkDifferent({
        orderNumber: linkingItem.order.orderNumber,
        newConversationId: conversationId,
      })
      toast.success('Thread linked', {
        action: {
          label: 'Open in Front',
          onClick: () => window.open(`https://app.frontapp.com/open/${conversationId}`, '_blank'),
        },
      })
      setLinkDialogOpen(false)
      setLinkingItem(null)
      setSearchEmail('')
      setSearchResults([])
      fetchPendingReviews()
    } catch (err) {
      toast.error('Failed to link', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSearching(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending Review</Badge>
      case 'not_found':
        return <Badge variant="secondary">Not Found</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {items.length} order{items.length !== 1 ? 's' : ''} need thread review
        </div>
        <Button variant="outline" size="sm" onClick={fetchPendingReviews}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
          <p>All caught up! No orders need thread review.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isExpanded = expandedRows.has(item.order.orderNumber)
              const isLoading = actionLoading === item.order.orderNumber
              
              return (
                <Collapsible key={item.order.orderNumber} open={isExpanded} asChild>
                  <>
                    <TableRow className={cn(isExpanded && 'bg-muted/50')}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(item.order.orderNumber)}
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
                        <div className="font-medium">
                          {item.order.orderName || `Order #${item.order.orderNumber}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          #{item.order.orderNumber} · {item.order.shipmentCount} shipment{item.order.shipmentCount !== 1 ? 's' : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.order.customerName && (
                          <div className="font-medium">{item.order.customerName}</div>
                        )}
                        {item.order.customerEmail && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {item.order.customerEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.thread.matchStatus)}
                      </TableCell>
                      <TableCell>
                        {item.thread.confidenceScore !== null ? (
                          <span className={cn(
                            'font-mono',
                            item.thread.confidenceScore >= 0.7 && 'text-green-600',
                            item.thread.confidenceScore >= 0.3 && item.thread.confidenceScore < 0.7 && 'text-yellow-600',
                            item.thread.confidenceScore < 0.3 && 'text-red-600'
                          )}>
                            {Math.round(item.thread.confidenceScore * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.thread.matchStatus === 'pending_review' && item.thread.frontConversationId && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(item)}
                                disabled={isLoading}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(item)}
                                disabled={isLoading}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSearch(item)}
                            disabled={isLoading}
                          >
                            <Search className="h-4 w-4 mr-1" />
                            {item.thread.matchStatus === 'not_found' ? 'Search' : 'Link Different'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6}>
                          <div className="py-2 px-4 space-y-2">
                            {item.thread.frontConversationId && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Conversation:</span>
                                <a
                                  href={`https://app.frontapp.com/open/${item.thread.frontConversationId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  {item.thread.conversationSubject || item.thread.frontConversationId}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                            <div className="flex gap-4 text-sm">
                              <span className={cn(
                                'flex items-center gap-1',
                                item.thread.emailMatched ? 'text-green-600' : 'text-muted-foreground'
                              )}>
                                {item.thread.emailMatched ? '✓' : '✗'} Email matched
                              </span>
                              <span className={cn(
                                'flex items-center gap-1',
                                item.thread.orderInSubject ? 'text-green-600' : 'text-muted-foreground'
                              )}>
                                {item.thread.orderInSubject ? '✓' : '✗'} Order in subject
                              </span>
                              {item.thread.daysSinceLastMessage !== null && (
                                <span className="text-muted-foreground">
                                  Last message: {item.thread.daysSinceLastMessage} days ago
                                </span>
                              )}
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
      )}

      {/* Manual Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Front Conversation</DialogTitle>
            <DialogDescription>
              Search by customer email or paste a conversation ID (cnv_...)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Email or conversation ID (cnv_...)"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchConversations()}
              />
              <Button onClick={searchConversations} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {searchResults.map((conv) => (
                  <button
                    key={conv.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 transition-colors"
                    onClick={() => handleLinkDifferent(conv.id)}
                  >
                    <div className="font-medium text-sm">
                      {conv.subject || '(No subject)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {conv.recipientEmail} · {conv.id}
                    </div>
                  </button>
                ))}
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
