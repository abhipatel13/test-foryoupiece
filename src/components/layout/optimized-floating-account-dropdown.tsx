'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useFloating, offset, flip, shift, size, autoUpdate, useClick, useDismiss, useInteractions } from '@floating-ui/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, User, Package, Heart, Settings, LogOut, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { requestUtils } from '@/lib/utils/request-deduplication'
import { useDropdownPerformance, useDropdownPerformanceMonitoring } from '@/lib/hooks/use-performance-optimization'
import dynamic from 'next/dynamic'


// Lazy load the PointsBreakdownComponent for better performance
const PointsBreakdownComponent = dynamic(
  () => import('@/components/user/points-breakdown').then(mod => ({ default: mod.PointsBreakdownComponent })),
  {
    loading: () => (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    ),
    ssr: false
  }
)

interface OptimizedFloatingAccountDropdownProps {
  className?: string
}

interface UserDisplayData {
  displayName: string
  email: string
  avatar?: string
  initials: string
}

export function OptimizedFloatingAccountDropdown({ className = '' }: OptimizedFloatingAccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userDisplayData, setUserDisplayData] = useState<UserDisplayData | null>(null)
  const [profileError, setProfileError] = useState(false)
  const router = useRouter()

  // Use optimized auth hook with caching
  const { user, profile, isAuthenticated, loading, signOut } = useSSRSafeAuth()

  // Performance optimization hooks with memoization
  const { handlePrefetchTrigger } = useDropdownPerformance()
  const { startTiming, endTiming } = useDropdownPerformanceMonitoring()

  // Memoize user display data to prevent unnecessary recalculations
  const memoizedUserDisplayData = useMemo(() => {
    if (!user || !profile) return null

    const firstName = profile.first_name || ''
    const lastName = profile.last_name || ''
    const displayName = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || user.email?.split('@')[0] || 'User'

    const initials = firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase()

    return {
      displayName,
      email: user.email || '',
      avatar: profile.avatar_url,
      initials
    }
  }, [user, profile])

  // Update user display data when memoized data changes
  useEffect(() => {
    if (memoizedUserDisplayData) {
      setUserDisplayData(memoizedUserDisplayData)
      setProfileError(false)
    } else if (isAuthenticated && !loading) {
      setProfileError(true)
    }
  }, [memoizedUserDisplayData, isAuthenticated, loading])

  // Optimized dropdown open/close handler
  const handleDropdownToggle = useCallback((open: boolean) => {
    if (open) {
      startTiming()
      // Prefetch data when opening dropdown
      handlePrefetchTrigger()
    } else {
      endTiming()
    }
    setIsOpen(open)
  }, [startTiming, endTiming, handlePrefetchTrigger])

  // Enhanced floating UI configuration with performance monitoring
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: handleDropdownToggle,
    middleware: [
      offset(8),
      flip({ padding: 16 }),
      shift({ padding: 16 }),
      size({
        apply({ availableWidth, availableHeight, elements }) {
          // Responsive sizing based on viewport
          const isMobile = availableWidth < 640
          const maxWidth = isMobile ? Math.min(availableWidth - 32, 280) : 320

          Object.assign(elements.floating.style, {
            maxWidth: `${maxWidth}px`,
            maxHeight: `${Math.min(availableHeight - 32, 400)}px`
          })
        },
        padding: 16
      })
    ],
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    strategy: 'fixed'
  })

  // Enhanced interactions for accessibility
  const click = useClick(context)
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Prepare user display data with memoization
  const preparedUserData = useMemo(() => {
    if (!user) return null

    const firstName = profile?.first_name || ''
    const lastName = profile?.last_name || ''
    const displayName = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || user.email?.split('@')[0] || 'User'

    const initials = firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase()

    return {
      displayName,
      email: user.email || '',
      avatar: profile?.avatar_url,
      initials
    }
  }, [user, profile])

  // Update display data when user data changes
  useEffect(() => {
    setUserDisplayData(preparedUserData)
  }, [preparedUserData])

  // Prefetch user data when dropdown opens for the first time
  useEffect(() => {
    if (isOpen && user?.id && !userDisplayData) {
      requestUtils.prefetchUserData(user.id).catch(console.warn)
    }
  }, [isOpen, user?.id, userDisplayData])

  // Handle sign out with loading state
  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      try { setIsOpen(false) } catch {}
      try {
        if (typeof window !== 'undefined') {
          try { localStorage.clear() } catch {}
          try { sessionStorage.clear() } catch {}
          window.location.replace('/en')
        }
      } catch {}
    }
  }, [signOut])

  // Show sign in link if not authenticated
  if (!isAuthenticated) {
    return (
      <div className={`flex items-center flex-shrink-0 min-w-0 ${className}`}>
        <Link
          href="/en/auth/login"
          className="flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary touch-target-44"
        >
          <div className="text-right mr-1 sm:mr-2 min-w-0">
            <div className="text-xs text-muted-foreground hidden lg:block">Hello, sign in</div>
            <div className="font-medium flex items-center truncate text-xs sm:text-sm">
              <span className="hidden lg:inline">Account & Lists</span>
              <span className="lg:hidden">Sign In</span>
              <ChevronDown className="h-3 w-3 ml-1 hidden sm:block" />
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // Don't render if still loading
  if (loading) {
    return (
      <div className={`flex items-center flex-shrink-0 min-w-0 ${className}`}>
        <div className="flex items-center text-foreground text-sm px-1 sm:px-2 lg:px-3 py-2">
          <div className="text-right mr-1 sm:mr-2 min-w-0">
            <Skeleton className="h-3 w-16 mb-1 hidden lg:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Account Button with prefetch triggers */}
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        variant="ghost"
        className={`flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary flex-shrink-0 min-w-0 touch-target-44 h-auto ${className}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onMouseEnter={handlePrefetchTrigger}
        onFocus={handlePrefetchTrigger}
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

      {/* Floating Dropdown with improved mobile positioning */}
      {isOpen && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="w-64 sm:w-72 bg-white rounded-md shadow-lg border z-[100] p-0 max-h-[80vh] overflow-y-auto sm:max-h-[60vh]"
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
              </div>
            </div>

            {/* Points Breakdown with Suspense */}
            {user?.id && (
              <div className="mt-3">
                <Suspense fallback={
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                }>
                  <PointsBreakdownComponent 
                    userId={user.id} 
                    variant="header" 
                    showTierProgress={false}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              href="/en/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <User className="mr-3 h-4 w-4" />
              Your Account
            </Link>
            <Link
              href="/en/orders"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <Package className="mr-3 h-4 w-4" />
              Your Orders
            </Link>
            <Link
              href="/en/wishlist"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <Heart className="mr-3 h-4 w-4" />
              Your Wish List
            </Link>
            <Link
              href="/en/account/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="mr-3 h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </button>
          </div>

          {/* Error State */}
          {profileError && (
            <div className="p-4 border-t">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">Some profile data may be unavailable</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
