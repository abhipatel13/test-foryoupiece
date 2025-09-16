"use client"

import { useEffect, useState, useCallback } from 'react'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { authFetch } from '@/lib/utils/auth-interceptor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Gift, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface AnnouncementCoupon {
  id: string
  code: string
  title: string
  description?: string
  expires_at?: string | null
}

export function CouponAnnouncementPopup() {
  const { user } = useSSRSafeAuth()
  const [coupon, setCoupon] = useState<AnnouncementCoupon | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchAnnouncement = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await authFetch('/api/user/coupons/announcements')
      if (res.ok) {
        const data = await res.json()
        const c = data?.data?.coupon as AnnouncementCoupon | null
        if (c && c.id) {
          setCoupon(c)
          setOpen(true)
        }
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    // On first auth state, attempt to fetch announcement
    fetchAnnouncement()
  }, [user, fetchAnnouncement])

  useEffect(() => {
    if (!user) return
    // Realtime: if a new coupon is created while user is browsing, re-check
    const supabase = createClient()
    if (!supabase) return
    const channel = supabase
      .channel('coupon-announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coupons' }, () => {
        // Debounced simple fetch
        fetchAnnouncement()
      })
      .subscribe()
    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [user, fetchAnnouncement])

  const close = async () => {
    setOpen(false)
    if (coupon) {
      try {
        await authFetch('/api/user/coupons/announcements/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ couponId: coupon.id })
        })
      } catch {}
    }
  }

  const copyCode = async () => {
    if (!coupon) return
    try {
      await navigator.clipboard.writeText(coupon.code)
      toast.success('Coupon code copied')
    } catch {
      toast.error('Failed to copy code')
    }
  }

  if (!user || !open || !coupon) return null

  return (
    <div
      role="dialog"
      aria-label="Coupon announcement"
      className="fixed z-[60] bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
    >
      <Card className="border shadow-lg bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Gift className="h-5 w-5 text-pink-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 pr-6">{coupon.title}</p>
              <button aria-label="Close" onClick={close} className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            {coupon.description && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-3">{coupon.description}</p>
            )}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-900 text-xs font-mono">
                <span className="truncate max-w-[160px]" aria-label="Coupon code">{coupon.code}</span>
                <button onClick={copyCode} className="text-gray-700 hover:text-gray-900" aria-label="Copy coupon code">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button size="sm" className="!ml-0 sm:!ml-2" onClick={close}>Got it</Button>
              <Button size="sm" variant="ghost" className="!ml-0 sm:!ml-1 text-xs" onClick={() => { close(); window.location.href = '/en/profile#notifications' }}>View in notifications</Button>
            </div>
            {coupon.expires_at && (
              <p className="text-[11px] text-gray-500 mt-1">Expires on {new Date(coupon.expires_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

