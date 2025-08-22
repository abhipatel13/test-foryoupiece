'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function toInputValue(dt?: string) {
  if (!dt) return ''
  const d = new Date(dt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export default function EditEventPage() {
  const { id, locale } = useParams() as { id: string, locale: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [event, setEvent] = useState<any | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${id}`)
        const data = await res.json()
        if (res.ok && data.success) {
          setEvent(data.data)
        }
      } catch {}
      setLoading(false)
    })()
  }, [id])

  async function save() {
    if (!event) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          is_active: event.is_active,
          metadata: event.metadata
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update')
      toast.success('Event updated')
      router.push(`/${locale}/fyponly-admin/events`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!event) return <div className="p-6">Event not found</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Event</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update title and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input id="title" value={event.title} onChange={e => setEvent((p: any) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Event Description</Label>
              <Textarea id="description" value={event.description || ''} onChange={e => setEvent((p: any) => ({ ...p, description: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule & Status</CardTitle>
            <CardDescription>Control timing and activation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date & Time</Label>
              <Input type="datetime-local" value={toInputValue(event.starts_at)} onChange={e => setEvent((p: any) => ({ ...p, starts_at: new Date(e.target.value).toISOString() }))} />
            </div>
            <div className="space-y-2">
              <Label>End Date & Time</Label>
              <Input type="datetime-local" value={toInputValue(event.ends_at)} onChange={e => setEvent((p: any) => ({ ...p, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!event.is_active} onCheckedChange={(v) => setEvent((p: any) => ({ ...p, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

