'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Plus, RefreshCw, Timer, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'

function formatDate(dt: string) {
  const d = new Date(dt)
  return d.toLocaleString()
}

export default function EventsAdminPage() {
  const params = useParams()
  const locale = params.locale as string
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: '1',
        limit: '50',
        ...(search ? { search } : {}),
        ...(onlyActive ? { active: 'currently_active' } : {})
      })
      const res = await fetch(`/api/admin/events?${qs.toString()}`)
      const data = await res.json()
      if (data.success) {
        setEvents(data.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const currentlyActive = useMemo(() => {
    const now = Date.now()
    return events.filter(e => e.is_active && new Date(e.starts_at).getTime() <= now && (!e.ends_at || new Date(e.ends_at).getTime() >= now))
  }, [events])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Create and manage promotional events</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/${locale}/fyponly-admin/events/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Link>
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search title or description" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
            <Label htmlFor="only-active">Only currently active</Label>
          </div>
          <Button variant="secondary" onClick={load}>Apply</Button>
        </CardContent>
      </Card>

      {/* Active banner preview */}
      <Card>
        <CardHeader>
          <CardTitle>Active Events</CardTitle>
          <CardDescription>Preview of events currently visible to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentlyActive.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active events</div>
          ) : (
            currentlyActive.map(ev => (
              <div key={ev.id} className="p-3 border rounded-md bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-black">{ev.event_type.replaceAll('_',' ').toUpperCase()}</Badge>
                    <span className="font-medium">{ev.title}</span>
                  </div>
                  {ev.description && <div className="text-sm text-muted-foreground mt-1">{ev.description}</div>}
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span>From {formatDate(ev.starts_at)}{ev.ends_at ? ` to ${formatDate(ev.ends_at)}` : ''}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
          <CardDescription>Manage status, dates, and details</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Title</th>
                <th className="py-2">Type</th>
                <th className="py-2">Schedule</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const now = Date.now()
                const isWithin = ev.is_active && new Date(ev.starts_at).getTime() <= now && (!ev.ends_at || new Date(ev.ends_at).getTime() >= now)
                return (
                  <tr key={ev.id} className="border-b">
                    <td className="py-2">
                      <div className="font-medium">{ev.title}</div>
                      {ev.description && <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{ev.description}</div>}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline">{ev.event_type}</Badge>
                    </td>
                    <td className="py-2 text-gray-600">
                      <div>{formatDate(ev.starts_at)}{ev.ends_at ? ` → ${formatDate(ev.ends_at)}` : ''}</div>
                    </td>
                    <td className="py-2">
                      {isWithin ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : ev.is_active ? (
                        <Badge className="bg-yellow-600">Scheduled</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => router.push(`/${locale}/fyponly-admin/events/${ev.id}`)}>Edit</Button>
                      <Button size="sm" variant="destructive" className="ml-1" onClick={async () => {
                        const confirmed = window.confirm('Are you sure you want to delete this event? This action cannot be undone.')
                        if (!confirmed) return
                        try {
                          const res = await fetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' })
                          const data = await res.json()
                          if (!res.ok || !data.success) {
                            alert(data.error || 'Failed to delete event')
                            return
                          }
                          // Refresh list
                          await load()
                        } catch (e) {
                          console.error('Failed to delete event', e)
                          alert('Failed to delete event')
                        }
                      }}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

