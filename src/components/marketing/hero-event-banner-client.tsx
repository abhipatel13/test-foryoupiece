"use client"
import React, { useEffect, useMemo, useState } from 'react'

interface ActiveEvent {
  id: string
  event_type: string
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  metadata: any
}

export default function HeroEventBannerClient() {
  const [events, setEvents] = useState<ActiveEvent[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/events/active?type=free_shipping', { cache: 'no-store' })
        const data = await res.json()
        if (mounted && data.success) setEvents(data.data as ActiveEvent[])
      } catch (e) {
        // noop
      }
    }
    load()
    const id = setInterval(load, 60 * 1000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const bannerEvent = useMemo(() => events.find(ev => ev.metadata?.banner?.showInHero), [events])
  if (!bannerEvent) return null

  const endsAt = bannerEvent.ends_at ? new Date(bannerEvent.ends_at) : null

  return (
    <div className="w-full bg-black text-white">
      <div className="desktop-container py-2 sm:py-3 text-center">
        <span className="text-xs sm:text-sm font-semibold tracking-wide">FREE SHIPPING EVENT</span>
        <span className="mx-2">•</span>
        <span className="text-xs sm:text-sm">{bannerEvent.title}</span>
        {bannerEvent.description ? <span className="hidden sm:inline text-xs sm:text-sm text-gray-200 ml-2">— {bannerEvent.description}</span> : null}
        {endsAt ? <span className="block sm:inline text-[10px] sm:text-xs text-gray-300 mt-1 sm:mt-0 sm:ml-2">Ends {endsAt.toLocaleString()}</span> : null}
      </div>
    </div>
  )
}

