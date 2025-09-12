"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Search, Send, UserSearch, MessageCircle, RefreshCw, RotateCcw, ShoppingBag } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  first_name?: string
  last_name?: string
  telegram_id?: number
  telegram_username?: string
  created_at?: string
}

interface RecentUserEntry {
  user: {
    id: string
    display_name: string
    email?: string
    telegram_username?: string
  }
  lastMessage: {
    id: string
    title: string
    message: string
    created_at: string
    metadata?: any
  }
  unreadCount: number
}

export default function CustomerCommunicationPage() {
  const params = useParams()
  const locale = params.locale as string

  // Configurable recent window (days) - Updated to 2 days for more focused recent order detection
  const RECENT_ORDER_DAYS = Number(process.env.NEXT_PUBLIC_RECENT_ORDER_DAYS || '2')

  // Left panel state
  const [userSearch, setUserSearch] = useState('')
  const [recentUsers, setRecentUsers] = useState<RecentUserEntry[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [recentOffset, setRecentOffset] = useState(0)
  const recentLimit = 20
  const [hasMoreRecent, setHasMoreRecent] = useState(false)

  // Right panel state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Recent orders for selected user
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false)

  // Recent orders for all users (to show badges in list)
  const [allUsersRecentOrders, setAllUsersRecentOrders] = useState<Record<string, any[]>>({})

  // Manual refresh state
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fullName = (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0]

  // Helper to reliably extract message text
  const getNotificationText = useCallback((n: any): string => {
    return (
      n?.message ||
      n?.metadata?.text ||
      n?.metadata?.telegram_text ||
      n?.metadata?.message_text ||
      n?.metadata?.raw?.message?.text ||
      ''
    )
  }, [])

  // Manual refresh functions
  const refreshConversations = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadRecent(0, userSearch)
      setLastRefresh(new Date())
    } finally {
      setRefreshing(false)
    }
  }, [userSearch, refreshing])

  const refreshMessages = useCallback(async () => {
    if (!selectedUser?.id || historyLoading) return
    await loadHistory(selectedUser.id)
    setLastRefresh(new Date())
  }, [selectedUser?.id, historyLoading])

  const sendTelegram = async () => {
    if (!selectedUser) {
      toast.message('Select a user first')
      return
    }
    if (!message.trim()) {
      toast.message('Write a message before sending')
      return
    }
    try {
      setSending(true)
      const res = await fetch('/api/admin/telegram/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          message: message.trim()
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (res.status === 409 && data?.suggestion?.deepLink) {
          toast.error('User must start a chat with the bot first. Share the link to start.');
          // Insert a helper note in history for visibility
          setHistory((h) => [{
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            title: 'Telegram DM not deliverable',
            message: `Ask the customer to open ${data.suggestion.deepLink} and press Start.`,
            metadata: { channel: 'telegram', status: 'undeliverable', direction: 'outgoing' }
          }, ...h])
          return
        }
        throw new Error(data.error || 'Failed to send')
      }
      toast.success('Telegram message sent')
      setMessage('')
      // Optimistically append to history
      setHistory((h) => [{
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        title: 'Message from ForYouPiece',
        message: message.trim(),
        metadata: { channel: 'telegram', telegram_message_id: data.result?.telegram_message_id, direction: 'outgoing' }
      }, ...h])

      // Refresh conversation list to update last message
      setTimeout(() => {
        loadRecent(0, userSearch)
      }, 1000)
    } catch (e: any) {
      console.error('Send telegram failed', e)
      toast.error(e.message || 'Sending failed')
    } finally {
      setSending(false)
    }
  }

  // Load recent orders for all users to show badges in the list
  const loadAllUsersRecentOrders = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return

    try {
      const promises = userIds.map(async (userId) => {
        try {
          const res = await fetch(`/api/admin/communications/recent-orders?userId=${encodeURIComponent(userId)}&limit=5`)
          const data = await res.json()
          if (res.ok && data?.success) {
            return { userId, orders: data.orders || [] }
          }
          return { userId, orders: [] }
        } catch (e) {
          return { userId, orders: [] }
        }
      })

      const results = await Promise.all(promises)
      const ordersMap: Record<string, any[]> = {}
      results.forEach(({ userId, orders }) => {
        ordersMap[userId] = orders
      })
      setAllUsersRecentOrders(ordersMap)
    } catch (e) {
      console.error('Failed to load recent orders for all users:', e)
    }
  }, [])

  const loadRecent = useCallback(async (offset = 0, searchQuery = '') => {
    try {
      setRecentLoading(true)
      setRecentError(null)

      const params = new URLSearchParams()
      params.set('limit', recentLimit.toString())
      params.set('offset', offset.toString())
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim())
      }

      const res = await fetch(`/api/admin/communications/recent-users?${params.toString()}`)
      const data = await res.json()

      if (res.ok && data?.success) {
        const users = data.users || []
        if (offset === 0) {
          setRecentUsers(users)
        } else {
          setRecentUsers(prev => [...prev, ...users])
        }
        setHasMoreRecent(data.hasMore || false)
        setRecentOffset(offset)

        // Load recent orders for all users to show badges
        const userIds = users.map((entry: RecentUserEntry) => entry.user.id)
        if (userIds.length > 0) {
          loadAllUsersRecentOrders(userIds)
        }
      } else {
        setRecentError(data.error || 'Failed to load conversations')
        if (offset === 0) {
          setRecentUsers([])
        }
      }
    } catch (e: any) {
      console.error('Load recent users failed', e)
      setRecentError(e.message || 'Failed to load conversations')
      if (offset === 0) {
        setRecentUsers([])
      }
    } finally {
      setRecentLoading(false)
    }
  }, [recentLimit, loadAllUsersRecentOrders])

  const loadHistory = useCallback(async (userId: string) => {
    try {
      setHistoryLoading(true)
      const res = await fetch(`/api/admin/communications/history?userId=${encodeURIComponent(userId)}&limit=20`)
      const data = await res.json()
      if (res.ok && data?.success) {
        const newHistory = data.notifications || []
        setHistory(prevHistory => {
          // Only update if there are actual changes to prevent unnecessary re-renders
          if (JSON.stringify(prevHistory) !== JSON.stringify(newHistory)) {
            // Scroll to bottom if new messages were added
            setTimeout(scrollToBottom, 100)
            return newHistory
          }
          return prevHistory
        })
      } else {
        setHistory([])
      }
    } catch (e) {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [scrollToBottom])

  const loadRecentOrders = useCallback(async (userId: string) => {
    try {
      setRecentOrdersLoading(true)
      const res = await fetch(`/api/admin/communications/recent-orders?userId=${encodeURIComponent(userId)}&limit=5`)
      const data = await res.json()
      if (res.ok && data?.success) {
        setRecentOrders(data.orders || [])
      } else {
        setRecentOrders([])
      }
    } catch (e) {
      setRecentOrders([])
    } finally {
      setRecentOrdersLoading(false)
    }
  }, [])
  // Mark messages as read for a user and clear badge locally
  const markReadForUser = useCallback(async (userId: string) => {
    try {
      await fetch('/api/admin/communications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
    } catch {}
    // Optimistically clear badge for this user
    setRecentUsers(prev => prev.map(e => e.user.id === userId ? { ...e, unreadCount: 0 } : e))
  }, [])







  // Load initial recent users
  useEffect(() => {
    loadRecent(0, '') // Load with empty search on mount
  }, []) // Only run once on mount

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadRecent(0, userSearch)
    }, userSearch.trim() ? 300 : 0) // 300ms debounce for search, immediate for clear

    return () => clearTimeout(timeoutId)
  }, [userSearch]) // Only run when userSearch changes

  // Load history + recent orders when user is selected
  useEffect(() => {
    if (selectedUser?.id) {
      // Load messages, then mark all incoming as read for this user
      loadHistory(selectedUser.id).then(() => markReadForUser(selectedUser.id))
      loadRecentOrders(selectedUser.id)
    }
  }, [selectedUser?.id]) // Only run when selectedUser.id changes



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="h-6 w-6"/> Customer Communication</h1>
        <p className="text-gray-600">Send direct messages to customers via Telegram using the authentication bot.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Recent users list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><UserSearch className="h-5 w-5"/> Conversations</CardTitle>
                <CardDescription>Recent chats with customers</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshConversations}
                disabled={refreshing}
                className="h-8 w-8 p-0"
                title="Refresh conversations"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, email, or @username"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {recentLoading && <div className="text-sm text-gray-500">Loading…</div>}
            {recentError && <div className="text-sm text-red-600">{recentError}</div>}

            <div className="flex flex-col divide-y">
              {recentUsers.map((entry, index) => {
                const isIncoming = entry.lastMessage?.metadata?.direction === 'incoming'
                const userOrders = allUsersRecentOrders[entry.user.id] || []
                const hasRecentOrders = userOrders.some(o => {
                  const days = (Date.now() - new Date(o.created_at).getTime()) / (1000*60*60*24)
                  return days <= RECENT_ORDER_DAYS
                })
                const previewMsg = (
                  entry?.lastMessage?.message ||
                  entry?.lastMessage?.metadata?.text ||
                  entry?.lastMessage?.metadata?.telegram_text ||
                  entry?.lastMessage?.metadata?.message_text ||
                  entry?.lastMessage?.metadata?.raw?.message?.text ||
                  ''
                )

                return (
                  <button
                    key={`${entry.user.id}-${index}`}
                    onClick={() => setSelectedUser({ id: entry.user.id, email: entry.user.email || '', first_name: entry.user.display_name.split(' ')[0], last_name: entry.user.display_name.split(' ').slice(1).join(' '), telegram_username: entry.user.telegram_username })}
                    className={`text-left px-3 py-2 rounded-md hover:bg-gray-50 ${selectedUser?.id === entry.user.id ? '!bg-gray-50 ring-1 ring-gray-200' : ''}`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{entry.user.display_name}</div>
                        {hasRecentOrders && (
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">
                            Recent Order
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(entry.lastMessage.created_at).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={isIncoming ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}>
                        {isIncoming ? 'Incoming' : 'Outgoing'}
                      </Badge>
                      <div className="text-xs text-gray-600 truncate">{previewMsg}</div>
                    </div>
                    {entry.unreadCount > 0 && (
                      <div className="mt-1">
                        <Badge className="bg-red-500 text-white border border-red-600 rounded-full px-2">{entry.unreadCount}</Badge>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {hasMoreRecent && (
              <div className="mt-2 flex justify-center">
                <Button size="sm" variant="secondary" onClick={() => loadRecent(recentOffset + recentLimit)} disabled={recentLoading}>Load more</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Chat panel + Recent Orders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chat panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span>Chat</span>
                    {selectedUser && (
                      <span className="text-sm text-gray-600">{fullName(selectedUser)} {selectedUser.telegram_username ? `(Telegram: @${selectedUser.telegram_username})` : ''}</span>
                    )}
                  </CardTitle>
                  <CardDescription>{selectedUser ? 'Two-way conversation history' : 'Select a conversation to view messages'}</CardDescription>
                </div>
                {selectedUser && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={refreshMessages}
                      disabled={historyLoading}
                      className="h-8 w-8 p-0"
                      title="Refresh messages"
                    >
                      <RotateCcw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="text-xs text-gray-500">
                      Last: {lastRefresh.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedUser && (
                <div className="text-sm text-gray-500">Select a conversation on the left to start messaging.</div>
              )}
              {selectedUser && (
                <div className="flex flex-col h-[60vh]">
                  <div className="flex-1 overflow-auto space-y-2 pr-1">
                    {historyLoading && <div className="text-sm text-gray-500">Loading messages…</div>}
                    {history.map((n, index) => {
                      const dir = n?.metadata?.direction === 'incoming' ? 'incoming' : 'outgoing'
                      const isIncoming = dir === 'incoming'
                      return (
                        <div key={`${n.id}-${index}`} className={`max-w-[85%] w-fit ${isIncoming ? 'self-start' : 'self-end'} `}>
                          <div className={`px-3 py-2 rounded-lg border text-sm ${isIncoming ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <Badge className={isIncoming ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}>
                                {isIncoming ? 'Incoming' : 'Outgoing'}
                              </Badge>
                              <div className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                            <div className="font-medium mt-1">{n.title}</div>
                            <div className="whitespace-pre-wrap mt-0.5">{getNotificationText(n)}</div>
                            {/* Delivery status (basic): use metadata.status if present */}
                            {n?.metadata?.status && (
                              <div className="text-[10px] text-gray-500 mt-1">Status: {n.metadata.status}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {history.length === 0 && !historyLoading && (
                      <div className="text-sm text-gray-500">No messages yet.</div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  {/* Compose in chat */}
                  <div className="mt-2 flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={sendTelegram} disabled={sending || !message.trim()}>
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          {selectedUser && (
            <Card>
              <CardHeader>
                {/* Priority notification when user recently ordered */}
                {Array.isArray(recentOrders) && recentOrders.some(o => {
                  const days = (Date.now() - new Date(o.created_at).getTime()) / (1000*60*60*24)
                  return days <= RECENT_ORDER_DAYS
                }) && (
                  <div className="mb-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Recently Ordered Customer
                    </Badge>
                  </div>
                )}
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" /> Recent Orders
                </CardTitle>
                <CardDescription>Latest orders by this customer</CardDescription>
              </CardHeader>
              <CardContent>
                {recentOrdersLoading && <div className="text-sm text-gray-500">Loading recent orders…</div>}
                {!recentOrdersLoading && recentOrders.length === 0 && (
                  <div className="text-sm text-gray-500">No orders found for this customer.</div>
                )}
                <div className="space-y-2">
                  {recentOrders.map((o, index) => (
                    <a key={`${o.id}-${index}`} href={`/${locale}/fyponly-admin/orders/${o.id}`} className="block border rounded-md p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Order #{o.order_number}</div>
                        <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-gray-500">ID: {o.id}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-2 mt-0.5">
                        <span>{o.item_count} items</span>
                        <span>•</span>
                        <span>Total: ${(o.total_amount || 0).toFixed(2)}</span>
                        <span>•</span>
                        <span className="capitalize">{o.payment_status}</span>
                        <span>/</span>
                        <span className="capitalize">{o.fulfillment_status}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

