"use client"

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Meta Pixel SPA PageView Tracker
 * - Fires fbq('track', 'PageView') on route changes
 * - Respects marketing consent (fyp_consent_marketing)
 * - No-op if fbq is not present or consent not granted
 */
export function MetaPageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initializedRef = useRef(false)

  // Helper consistent with root layout
  function hasMarketingConsent(): boolean {
    try {
      const key = 'fyp_consent_marketing'
      const fromLS = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      const fromCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.indexOf('fyp_consent_marketing=true') !== -1) ? 'true' : null
      return fromLS === 'true' || fromCookie === 'true'
    } catch {
      return false
    }
  }

  useEffect(() => {
    // Fire once on first mount as a fallback if layout init missed (should be redundant)
    if (!initializedRef.current) {
      initializedRef.current = true
      try {
        if (hasMarketingConsent() && typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
          ;(window as any).fbq('track', 'PageView')
          if (process.env.NEXT_PUBLIC_DEBUG_ANALYTICS === 'true') {
            // eslint-disable-next-line no-console
            console.log('Meta Pixel SPA PageView (mount) fired')
          }
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      if (hasMarketingConsent() && typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        ;(window as any).fbq('track', 'PageView')
        if (process.env.NEXT_PUBLIC_DEBUG_ANALYTICS === 'true') {
          // eslint-disable-next-line no-console
          console.log('Meta Pixel SPA PageView fired on route change', { pathname, search: searchParams?.toString() })
        }
      }
    } catch {}
    // Trigger on path or query change
  }, [pathname, searchParams])

  return null
}

