'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useHydration } from '@/lib/hooks/use-hydration'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
// Removed Radix DropdownMenu imports - using custom dropdown instead
import {
  ChevronDown,
  User,
  Package,
  Heart,
  Settings,
  LogOut,
} from 'lucide-react'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'

interface OptimizedAccountDropdownProps {
  className?: string
}

export function OptimizedAccountDropdown({ className = '' }: OptimizedAccountDropdownProps) {
  const { user, profile, isAuthenticated, loading, signOut } = useSSRSafeAuth()
  const mounted = useHydration() // Fix: useHydration returns boolean, not object
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Multi-tab synchronization
  const { broadcast } = useMultiTabSync({
    onAuthStateChange: (payload) => {
      // Handle auth state changes from other tabs
      console.log('🔄 Auth state change from another tab:', payload)
    },
    onProfileUpdate: (payload) => {
      // Handle profile updates from other tabs
      console.log('🔄 Profile update from another tab:', payload)
    }
  })

  // Memoized user display data to prevent unnecessary re-renders
  const userDisplayData = useMemo(() => {
    if (!profile) return null

    return {
      displayName: profile.first_name || profile.telegram_username || 'User',
      email: profile.email || 'Telegram User',
      avatar: profile.avatar_url || '',
      initials: profile.first_name?.[0] || profile.telegram_username?.[0] || 'U'
    }
  }, [profile])

  // Optimized sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      console.log('🚪 Account dropdown: Starting sign out process')
      setDropdownOpen(false)

      // Set global sign-out flag immediately
      if (typeof window !== 'undefined') {
        ;(window as any).signOutInProgress = true
      }

      // Broadcast auth change to other tabs immediately
      broadcast('AUTH_STATE_CHANGE', { user: null })

      // Call sign out function
      await signOut()
    } catch (error) {
      console.error('❌ Sign out error:', error)
    } finally {
      try {
        if (typeof window !== 'undefined') {
          try { localStorage.clear() } catch {}
          try { sessionStorage.clear() } catch {}
          window.location.replace('/en')
        }
      } catch {}
    }
  }, [signOut, broadcast])

  // Handle profile loading errors
  useEffect(() => {
    if (isAuthenticated && user && !profile && !loading) {
      setProfileError('Failed to load user profile')
    } else {
      setProfileError(null)
    }
  }, [isAuthenticated, user, profile, loading])

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-dropdown-container]')) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])



  // Show loading state during hydration
  if (!mounted || loading) {
    return (
      <div className={`flex items-center text-foreground text-sm px-1 sm:px-2 lg:px-3 py-2 rounded-lg flex-shrink-0 min-w-0 ${className}`}>
        <div className="text-right mr-1 sm:mr-2 min-w-0">
          <div className="text-xs text-muted-foreground hidden sm:block">Loading...</div>
          <div className="font-medium flex items-center truncate text-xs sm:text-sm">
            <span className="hidden md:inline">Account</span>
            <span className="md:hidden">...</span>
            <ChevronDown className="h-3 w-3 ml-1 hidden sm:block" />
          </div>
        </div>
      </div>
    )
  }

  // Show unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className={`flex items-center space-x-1 sm:space-x-2 ${className}`}>
        <Link 
          href="/en/auth/login" 
          className="flex items-center text-foreground text-sm hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary flex-shrink-0 min-w-0"
        >
          <div className="text-right">
            <div className="text-xs text-muted-foreground hidden lg:block">Hello, sign in</div>
            <div className="font-medium flex items-center text-xs sm:text-sm">
              <span className="hidden lg:inline">Account & Lists</span>
              <span className="lg:hidden">Account</span>
              <ChevronDown className="h-3 w-3 ml-1 hidden sm:block" />
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // Show error state
  if (profileError) {
    return (
      <div className={`flex items-center text-red-500 text-sm px-1 sm:px-2 lg:px-3 py-2 rounded-lg flex-shrink-0 min-w-0 ${className}`}>
        <div className="text-right mr-1 sm:mr-2 min-w-0">
          <div className="text-xs hidden sm:block">Error</div>
          <div className="font-medium flex items-center truncate text-xs sm:text-sm">
            <span>Profile Error</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" data-dropdown-container>
      {/* Account Button */}
      <Button
        variant="ghost"
        className={`flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary flex-shrink-0 min-w-0 touch-target-44 h-auto ${className}`}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <div className="text-right mr-1 sm:mr-2 min-w-0">
          <div className="text-xs text-muted-foreground truncate hidden lg:block">
            Hello, {userDisplayData?.displayName || 'User'}
          </div>
          <div className="font-medium flex items-center text-xs sm:text-sm">
            <span className="hidden lg:inline">Account & Lists</span>
            <span className="lg:hidden truncate max-w-[50px] sm:max-w-[70px]">
              {userDisplayData?.displayName || 'Account'}
            </span>
            <ChevronDown className="h-3 w-3 ml-1 hidden sm:block" />
          </div>
        </div>
      </Button>

      {/* Custom Dropdown - No Radix UI positioning issues! */}
      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => setDropdownOpen(false)}
          />

          {/* Custom Dropdown Content */}
          <div
            className="fixed right-4 top-16 w-64 sm:w-72 bg-white rounded-md shadow-lg border z-[60] p-0"
            role="menu"
            aria-orientation="vertical"
          >
            {/* User Info Header */}
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userDisplayData?.avatar || ''} alt={userDisplayData?.displayName || ''} />
                  <AvatarFallback>
                    {userDisplayData?.initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userDisplayData?.displayName || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userDisplayData?.email || 'No email'}
                  </p>

                  {/* Enhanced Points Display */}
                  {user?.id && (
                    <div className="pt-2 border-t border-gray-100 mt-2">
                      <PointsBreakdownComponent
                        userId={user.id}
                        variant="header"
                        showTierProgress={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                href="/en/profile"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setDropdownOpen(false)}
                role="menuitem"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Your Account</span>
              </Link>

              <Link
                href="/en/orders"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setDropdownOpen(false)}
                role="menuitem"
              >
                <Package className="mr-2 h-4 w-4" />
                <span>Your Orders</span>
              </Link>

              <Link
                href="/en/wishlist"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setDropdownOpen(false)}
                role="menuitem"
              >
                <Heart className="mr-2 h-4 w-4" />
                <span>Your Wish List</span>
              </Link>

              <Link
                href="/en/settings"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setDropdownOpen(false)}
                role="menuitem"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                role="menuitem"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
