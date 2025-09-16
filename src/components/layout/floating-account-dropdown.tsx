'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFloating, offset, flip, shift, size, autoUpdate, useClick, useDismiss, useInteractions } from '@floating-ui/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown, User, Package, Heart, Settings, LogOut, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'


interface FloatingAccountDropdownProps {
  className?: string
}

interface UserDisplayData {
  displayName: string
  email: string
  avatar?: string
  initials: string
}

export function FloatingAccountDropdown({ className = '' }: FloatingAccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userDisplayData, setUserDisplayData] = useState<UserDisplayData | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { signOut } = useSSRSafeAuth()

  const router = useRouter()
  const supabase = createClient()

  // Enhanced floating UI setup with mobile-first responsive positioning
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(({ rects, placement }) => {
        // Increase offset on mobile to avoid header overlap
        const isMobile = window.innerWidth < 640
        return isMobile ? 16 : 8
      }),
      flip({
        fallbackPlacements: ['bottom-start', 'top-end', 'top-start'],
        padding: 16
      }),
      shift({
        padding: 16,
        crossAxis: true
      }),
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
    strategy: 'fixed' // Fixed positioning for better mobile support
  })

  // Enhanced interactions for accessibility
  const click = useClick(context)
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true)
        setProfileError(false)

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
          setUser(null)
          setUserDisplayData(null)
          setIsLoading(false)
          return
        }

        setUser(authUser)

        // Get user profile data with improved error handling
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, avatar_url')
          .eq('user_id', authUser.id)
          .single()

        // Handle profile errors gracefully - don't show error for missing profiles
        if (profileError) {
          // Only set error state for unexpected errors, not missing profiles
          if (profileError.code !== 'PGRST116' && profileError.code !== '42P01') {
            console.error('Profile fetch error:', profileError.message)
            setProfileError(true)
          } else {
            // Profile doesn't exist yet - this is normal for new users
            setProfileError(false)
          }
        }

        // Prepare display data with fallbacks
        const firstName = profile?.first_name || ''
        const lastName = profile?.last_name || ''
        const displayName = firstName && lastName
          ? `${firstName} ${lastName}`
          : firstName || lastName || authUser.email?.split('@')[0] || 'User'

        const initials = firstName && lastName
          ? `${firstName[0]}${lastName[0]}`.toUpperCase()
          : displayName.slice(0, 2).toUpperCase()

        setUserDisplayData({
          displayName,
          email: authUser.email || '',
          avatar: profile?.avatar_url,
          initials
        })

      } catch (error) {
        // Only log unexpected errors in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('User data loading failed (expected in test environment):', error instanceof Error ? error.message : 'Unknown error')
        }
        setProfileError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [])

  // Handle sign out with hard reload + storage clear
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
          window.location.replace('/en/auth/login')
        }
      } catch {}
    }
  }, [signOut])

  // Close dropdown when clicking menu items
  const handleMenuItemClick = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center text-muted-foreground text-sm px-1 sm:px-2 lg:px-3 py-2 rounded-lg flex-shrink-0 min-w-0 ${className}`}>
        <div className="text-right mr-1 sm:mr-2 min-w-0">
          <div className="text-xs hidden sm:block">Loading...</div>
          <div className="font-medium flex items-center truncate text-xs sm:text-sm">
            <span>Account</span>
            <ChevronDown className="h-3 w-3 ml-1 hidden sm:block" />
          </div>
        </div>
      </div>
    )
  }

  // Show sign in link if not authenticated
  if (!user) {
    return (
      <div className={`flex items-center flex-shrink-0 min-w-0 ${className}`}>
        <Link href="/en/auth" className="flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary touch-target-44">
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

  // Show error state - simplified for production
  if (profileError) {
    return (
      <div className={`flex items-center text-orange-600 text-sm px-1 sm:px-2 lg:px-3 py-2 rounded-lg flex-shrink-0 min-w-0 ${className}`}>
        <AlertCircle className="h-4 w-4 mr-1" />
        <div className="text-right min-w-0">
          <div className="text-xs hidden sm:block">Service</div>
          <div className="font-medium flex items-center truncate text-xs sm:text-sm">
            <span className="hidden lg:inline">Temporarily Unavailable</span>
            <span className="lg:hidden">Unavailable</span>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center text-muted-foreground text-sm px-1 sm:px-2 lg:px-3 py-2 rounded-lg flex-shrink-0 min-w-0 ${className}`}>
        <div className="text-right mr-1 sm:mr-2 min-w-0">
          <div className="text-xs hidden sm:block">Loading...</div>
          <div className="font-medium flex items-center truncate text-xs sm:text-sm">
            <span className="hidden lg:inline">Account & Lists</span>
            <span className="lg:hidden">Loading</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Account Button */}
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        variant="ghost"
        className={`flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary flex-shrink-0 min-w-0 touch-target-44 h-auto ${className}`}
        aria-expanded={isOpen}
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

      {/* Floating Dropdown with improved mobile positioning */}
      {isOpen && (
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            // Ensure dropdown appears below header on mobile
            ...(window.innerWidth < 640 && {
              top: Math.max(parseFloat(floatingStyles.top || '0'), 70),
              right: '5vw',
              left: 'auto',
              transform: 'none'
            })
          }}
          {...getFloatingProps()}
          className="w-64 sm:w-72 bg-white rounded-md shadow-lg border z-[100] p-0 max-h-[80vh] overflow-y-auto"
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
              onClick={handleMenuItemClick}
              role="menuitem"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Your Account</span>
            </Link>

            <Link
              href="/en/orders"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={handleMenuItemClick}
              role="menuitem"
            >
              <Package className="mr-2 h-4 w-4" />
              <span>Your Orders</span>
            </Link>

            <Link
              href="/en/wishlist"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={handleMenuItemClick}
              role="menuitem"
            >
              <Heart className="mr-2 h-4 w-4" />
              <span>Your Wish List</span>
            </Link>

            <Link
              href="/en/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={handleMenuItemClick}
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
      )}
    </div>
  )
}
