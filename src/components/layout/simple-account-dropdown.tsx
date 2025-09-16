'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFloating, offset, flip, shift, autoUpdate, useClick, useDismiss, useInteractions } from '@floating-ui/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, User, Package, Heart, Settings, LogOut, Coins, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { getCorrectUserTier } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/utils/auth-interceptor'

interface SimpleAccountDropdownProps {
  className?: string
}

interface UserDisplayData {
  name: string
  email: string
  initials: string
  points: number
  tier: string
}

export function SimpleAccountDropdown({ className = '' }: SimpleAccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userDisplayData, setUserDisplayData] = useState<UserDisplayData | null>(null)
  const router = useRouter()

  const { user, profile, isAuthenticated, loading, profileLoading, signOut } = useSSRSafeAuth()

  // Use simple auth hook without complex optimizations
  const [unreadCount, setUnreadCount] = useState(0)
  const refreshUnread = useCallback(async () => {
    try {
      const res = await authFetch(`/api/user/notifications?limit=1&_=${Date.now()}` as string, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unread_count || 0)
      }
    } catch {}
  }, [])

  // Initial load + realtime subscription for accuracy
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    refreshUnread()
    const supabase = createClient()
    if (!supabase) return
    const ch = supabase
      .channel(`account-dropdown-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        refreshUnread()
      })
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [isAuthenticated, user?.id, refreshUnread])

  // Also refresh unread count when other parts of the app dispatch a notifications refresh/cleared event
  useEffect(() => {
    const onRefresh = () => { try { refreshUnread() } catch {} }
    try {
      window.addEventListener('notifications:refresh', onRefresh as any)
      window.addEventListener('notifications:cleared', onRefresh as any)
    } catch {}
    return () => {
      try {
        window.removeEventListener('notifications:refresh', onRefresh as any)
        window.removeEventListener('notifications:cleared', onRefresh as any)
      } catch {}
    }
  }, [refreshUnread])



  const [authSigningIn, setAuthSigningIn] = useState(false)

  // Read cross-page sign-in flag set by Telegram widget and others (with TTL)
  useEffect(() => {
    const FLAG_KEY = 'AUTH_SIGNIN_IN_PROGRESS'
    const TTL_MS = 3 * 60 * 1000 // 3 minutes safety

    const isFlagValid = (raw: string | null) => {
      if (!raw) return false
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.ts === 'number') {
          const fresh = Date.now() - parsed.ts < TTL_MS
          if (!fresh) localStorage.removeItem(FLAG_KEY)
          return fresh
        }
        // Legacy value handling: treat as invalid to avoid pre-click confusion
        return false
      } catch {
        // Non-JSON legacy value
        if (raw === '1') {
          // Treat as invalid to prevent stale banner
          localStorage.removeItem(FLAG_KEY)
        }
        return false
      }
    }

    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(FLAG_KEY) : null
      setAuthSigningIn(isFlagValid(raw))
      const onStorage = (e: StorageEvent) => {
        if (e.key === FLAG_KEY) {
          setAuthSigningIn(isFlagValid(e.newValue))
        }
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    } catch {}
  }, [])

  // Clear flag once authenticated
  useEffect(() => {
    try {
      if (isAuthenticated) {
        localStorage.removeItem('AUTH_SIGNIN_IN_PROGRESS')
        setAuthSigningIn(false)
      }
    } catch {}
  }, [isAuthenticated])

  // Floating UI setup with proper overlay positioning
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      // Keep menu below trigger; avoid flipping to top to prevent upward dropdowns
      // Remove flip or restrict to bottom-aligned behavior only
      // flip({ fallbackPlacements: ['bottom-end', 'bottom-start'], padding: 16 }),
      shift({ padding: 16 })
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-end',
    strategy: 'fixed' // Use fixed to avoid clipping and ensure stable below-header positioning
  })

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Simple user data preparation with defensive points mapping
  useEffect(() => {
    if (user && profile) {
      const firstName = profile.first_name || ''
      const lastName = profile.last_name || ''
      const name = firstName && lastName ? `${firstName} ${lastName}` : user.email?.split('@')[0] || 'User'

      // Prefer points_balance; if undefined, try fallback fields
      const rawPoints = (profile as any).points_balance ?? (profile as any).points ?? 0
      const points = typeof rawPoints === 'number' && !Number.isNaN(rawPoints) ? rawPoints : 0

      setUserDisplayData({
        name,
        email: user.email || '',
        initials: firstName && lastName
          ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
          : (user.email?.charAt(0) || 'U').toUpperCase(),
        points,
        tier: getCorrectUserTier(profile)
      })
    } else if (user) {
      // Fallback shell even if profile is not yet available to keep dropdown responsive
      setUserDisplayData({
        name: user.email?.split('@')[0] || 'User',
        email: user.email || '',
        initials: (user.email?.charAt(0) || 'U').toUpperCase(),
        points: 0,
        tier: 'bronze'
      })
    } else {
      setUserDisplayData(null)
    }
  }, [user, profile, profileLoading])

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      try {
        setIsOpen(false)
      } catch {}
      try {
        if (typeof window !== 'undefined') {
          try { localStorage.clear() } catch {}
          try { sessionStorage.clear() } catch {}
          window.location.replace('/en')
        }
      } catch {}
    }
  }, [signOut])

  // Only show loading skeleton during session hydration, not profile loading
  // This allows the dropdown to be clickable even when profile is still loading
  if (loading && !user) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="hidden">
          <div className="h-4 w-24 bg-muted animate-pulse rounded mb-1" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground animate-pulse" />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    if (authSigningIn) {
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          <Button variant="ghost" size="sm" disabled className="text-xs">
            <span className="relative inline-flex items-center">
              <span className="inline-block h-3 w-3 mr-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              We are signing you in, please wait...
            </span>
          </Button>
        </div>
      )
    }
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Link href="/en/auth/login">
          <Button variant="ghost" size="sm" className="text-sm">
            Sign In
          </Button>
        </Link>
      </div>
    )
  }

  // No user data yet
  if (!userDisplayData) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="hidden">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    )
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'text-blue-600'
      case 'platinum': return 'text-purple-600'
      case 'gold': return 'text-yellow-600'
      case 'silver': return 'text-gray-600'
      default: return 'text-amber-600'
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        ref={refs.setReference}
        variant="ghost"
        className="flex items-center space-x-2 px-2 py-1 min-h-[44px] hover:bg-accent/50 transition-colors touch-target"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'account-dropdown-menu' : undefined}
        {...getReferenceProps()}
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayData.name} />
            <AvatarFallback className="text-xs font-medium">
              {userDisplayData.initials}
            </AvatarFallback>
          </Avatar>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <div className="hidden text-left min-w-0">
          <div className="text-sm font-medium truncate">
            Hello, {userDisplayData.name.split(' ')[0]}
          </div>
          <div className="text-xs text-muted-foreground flex items-center space-x-1">
            <span>Account & Lists</span>
          </div>
        </div>

        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>

      {isOpen && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          id="account-dropdown-menu"
          role="menu"
          aria-label="Account menu"
          className="z-[100] min-w-[280px] bg-background border border-border rounded-lg shadow-lg p-0 animate-in fade-in-0 zoom-in-95"
          {...getFloatingProps()}
        >
          {/* User Info Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayData.name} />
                <AvatarFallback className="text-sm font-medium">
                  {userDisplayData.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {userDisplayData.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userDisplayData.email}
                </p>
              </div>
            </div>

            {/* Simple Points Display */}
            <div className="mt-3 p-2 bg-accent/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Coins className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Points</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {userDisplayData.points.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">Tier</span>
                <span className={`text-xs font-medium ${getTierColor(userDisplayData.tier)}`}>
                  {userDisplayData.tier.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link href="/en/profile" role="menuitem" onClick={() => setIsOpen(false)}>
              <div className="flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                <User className="h-4 w-4" />
                <span>Your Account</span>
              </div>
            </Link>

            <Link href="/en/orders" role="menuitem" onClick={() => setIsOpen(false)}>
              <div className="flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                <Package className="h-4 w-4" />
                <span>Your Orders</span>
              </div>
            </Link>

            <Link href="/en/wishlist" role="menuitem" onClick={() => setIsOpen(false)}>
              <div className="flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                <Heart className="h-4 w-4" />
                <span>Your Wish List</span>
              </div>
            </Link>

            <Link href="/en/settings" role="menuitem" onClick={() => setIsOpen(false)}>
              <div className="flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </div>
            </Link>

            <Link href="/en/profile#notifications" role="menuitem" onClick={() => setIsOpen(false)}>
              <div className="flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </Link>

            <div className="border-t border-border my-2"></div>

            <button
              onClick={handleSignOut}
              role="menuitem"
              className="w-full flex items-center space-x-3 px-3 py-2 min-h-[44px] text-sm rounded-md hover:bg-accent/50 transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
