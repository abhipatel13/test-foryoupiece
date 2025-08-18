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

  // Use simple auth hook without complex optimizations
  const { user, profile, isAuthenticated, loading, profileLoading, signOut } = useSSRSafeAuth()

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

  // Simple user data preparation
  useEffect(() => {
    if (user && profile) {
      const firstName = profile.first_name || ''
      const lastName = profile.last_name || ''
      const name = firstName && lastName ? `${firstName} ${lastName}` : user.email?.split('@')[0] || 'User'

      setUserDisplayData({
        name,
        email: user.email || '',
        initials: firstName && lastName
          ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
          : (user.email?.charAt(0) || 'U').toUpperCase(),
        points: profile.points_balance || 0,
        tier: getCorrectUserTier(profile)
      })
    } else if (user && profileLoading) {
      // Show minimal shell when user exists but profile is still loading
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
      setIsOpen(false)
      router.push('/en')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }, [signOut, router])

  // Only show loading skeleton during session hydration, not profile loading
  // This allows the dropdown to be clickable even when profile is still loading
  if (loading && !user) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="hidden sm:block">
          <div className="h-4 w-24 bg-muted animate-pulse rounded mb-1" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground animate-pulse" />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
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
        <div className="hidden sm:block">
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
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayData.name} />
          <AvatarFallback className="text-xs font-medium">
            {userDisplayData.initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="hidden sm:block text-left min-w-0">
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
