'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function toInputValue(d?: Date | string) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export default function NewEventPage() {
  const { locale } = useParams() as { locale: string }
  const router = useRouter()

  const [form, setForm] = useState({
    event_type: 'free_shipping',
    title: '',
    description: '',
    starts_at: toInputValue(new Date()),
    ends_at: '',
    is_active: true,
    metadata: { banner: { showInHero: true } }
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null
      }
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create event')
      }
      toast.success('Event created')
      router.push(`/${locale}/fyponly-admin/events`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
          <p className="text-muted-foreground">Start with Free Shipping event; extensible for future types</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Title and description shown to customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input id="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Free Shipping Week" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Event Description</Label>
              <Textarea id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short details like New Year Event!" />
            </div>
          </CardContent>
        </Card>

        {/* Scheduling & Status */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule & Status</CardTitle>
            <CardDescription>Control when the event starts/ends and activation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Start Date & Time</Label>
              <Input id="starts_at" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">End Date & Time (optional)</Label>
              <Input id="ends_at" type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </CardContent>
        </Card>

        {/* Free Shipping Options */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Free Shipping Options</CardTitle>
            <CardDescription>Initial feature: when active, shipping fee is $0.00</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Show hero banner when event active</Label>
              <div className="flex items-center gap-2">
                <Switch checked={form.metadata.banner?.showInHero} onCheckedChange={(v) => setForm({ ...form, metadata: { ...form.metadata, banner: { ...(form.metadata.banner||{}), showInHero: v } } })} />
                <span className="text-sm text-muted-foreground">Displays a promotional banner in hero section</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Event'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

