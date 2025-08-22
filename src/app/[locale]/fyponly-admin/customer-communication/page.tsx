"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Search, Send, UserSearch, MessageCircle } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  first_name?: string
  last_name?: string
  telegram_id?: number
  telegram_username?: string
  created_at?: string
}

export default function CustomerCommunicationPage() {
  const params = useParams()
  const locale = params.locale as string

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<any>(null)

  const fullName = (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0]

  const runSearch = async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([])
      return
    }
    try {
      setSearching(true)
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q.trim())}&limit=10`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Search failed')
      setResults(data.users)
    } catch (e: any) {
      console.error('User search failed', e)
    } finally {
      setSearching(false)
    }
  }

  const onQueryChange = (val: string) => {
    setQuery(val)
    setShowSuggestions(true)
    if (debounceTimer) clearTimeout(debounceTimer)
    const t = setTimeout(() => runSearch(val), 300)
    setDebounceTimer(t)
  }

  const searchUsers = async () => {
    if (!query.trim()) {
      toast.message('Enter email or Telegram username to search')
      return
    }
    await runSearch(query)
    if (results.length === 0) {
      toast.info('No users found for your query')
    }
  }

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
    } catch (e: any) {
      console.error('Send telegram failed', e)
      toast.error(e.message || 'Sending failed')
    } finally {
      setSending(false)
    }
  }

  const loadHistory = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/communications/history?userId=${encodeURIComponent(userId)}&limit=20`)
      const data = await res.json()
      if (res.ok && data?.success) {
        setHistory(data.notifications || [])
      } else {
        setHistory([])
      }
    } catch (e) {
      setHistory([])
    }
  }

  useEffect(() => {
    if (selectedUser?.id) {
      loadHistory(selectedUser.id)
    }
  }, [selectedUser?.id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="h-6 w-6"/> Customer Communication</h1>
        <p className="text-gray-600">Send direct messages to customers via Telegram using the authentication bot.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserSearch className="h-5 w-5"/> Find Customer</CardTitle>
          <CardDescription>Search by email or Telegram username (e.g. @username)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by email or Telegram username"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => results.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="pl-9"
              />
              {showSuggestions && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-72 overflow-auto">
                  {searching && (
                    <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                  )}
                  {!searching && results.length === 0 && query.trim().length >= 2 && (
                    <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                  )}
                  {!searching && results.map(u => (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setShowSuggestions(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      <div className="font-medium text-sm">{fullName(u)}</div>
                      <div className="text-xs text-gray-600 break-all">{u.email}</div>
                      <div className="text-xs text-gray-600">{u.telegram_username ? `@${u.telegram_username}` : 'No Telegram linked'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={searchUsers} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Results */}
          <div className="mt-4 grid gap-2">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`text-left p-3 rounded-md border transition hover:bg-gray-50 ${selectedUser?.id === u.id ? 'border-gray-900' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{fullName(u)}</div>
                    <div className="text-sm text-gray-600">{u.email}</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {u.telegram_username ? `@${u.telegram_username}` : 'No Telegram linked'}
                  </div>
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="text-sm text-gray-500">No results. Try searching above.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5"/> Compose Message</CardTitle>
          <CardDescription>Send a direct Telegram message via @Authenticationfypbot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Selected Customer</Label>
            <div className="mt-1 text-sm">
              {selectedUser ? (
                <span>
                  {fullName(selectedUser)} {selectedUser.telegram_username ? `(Telegram: @${selectedUser.telegram_username})` : '(No Telegram)'}
                </span>
              ) : (
                <span className="text-gray-500">None selected</span>
              )}
            </div>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={sendTelegram} disabled={sending || !selectedUser || !message.trim()}>
              {sending ? 'Sending...' : 'Send Telegram'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
          <CardDescription>Showing last 20 notifications for the selected customer</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedUser ? (
            <div className="space-y-3">
              {history.map((n) => {
                const dir = n?.metadata?.direction === 'incoming' ? 'incoming' : 'outgoing'
                const isIncoming = dir === 'incoming'
                return (
                  <div key={n.id} className="p-3 rounded-md border border-gray-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-600">{new Date(n.created_at).toLocaleString()}</div>
                      <Badge
                        aria-label={isIncoming ? 'Incoming message' : 'Outgoing message'}
                        className={isIncoming ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}
                      >
                        {isIncoming ? 'Incoming' : 'Outgoing'}
                      </Badge>
                    </div>
                    <div className="font-medium mt-1">{n.title}</div>
                    <div className="text-sm whitespace-pre-wrap mt-0.5">{n.message}</div>
                  </div>
                )
              })}
              {history.length === 0 && (
                <div className="text-sm text-gray-500">No messages yet.</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a customer to view history.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

