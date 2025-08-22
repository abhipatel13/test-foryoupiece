import React from 'react'
import { eventsService } from '@/lib/services/events-service'

export default async function HeroEventBanner() {
  // Server Component: fetch currently active events for hero banner
  try {
    const events = await eventsService.getCurrentlyActive()
    const bannerEvents = events.filter(ev => ev.event_type === 'free_shipping' && ev.metadata?.banner?.showInHero)
    if (bannerEvents.length === 0) return null

    const ev = bannerEvents[0]
    const endsAt = ev.ends_at ? new Date(ev.ends_at) : null

    return (
      <div className="w-full bg-black text-white">
        <div className="desktop-container py-2 sm:py-3 text-center">
          <span className="text-xs sm:text-sm font-semibold tracking-wide">FREE SHIPPING EVENT</span>
          <span className="mx-2">•</span>
          <span className="text-xs sm:text-sm">{ev.title}</span>
          {ev.description ? <span className="hidden sm:inline text-xs sm:text-sm text-gray-200 ml-2">— {ev.description}</span> : null}
          {endsAt ? <span className="block sm:inline text-[10px] sm:text-xs text-gray-300 mt-1 sm:mt-0 sm:ml-2">Ends {endsAt.toLocaleString()}</span> : null}
        </div>
      </div>
    )
  } catch (e) {
    return null
  }
}

