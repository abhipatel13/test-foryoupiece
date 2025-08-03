'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useHydration } from '@/lib/hooks/use-hydration'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const { mounted } = useHydration()
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
      setDropdownOpen(false)
      await signOut()
      
      // Broadcast auth change to other tabs
      broadcast('AUTH_STATE_CHANGE', { user: null })
    } catch (error) {
      console.error('❌ Sign out error:', error)
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
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-1 sm:px-2 lg:px-3 py-2 rounded-lg hover:bg-secondary flex-shrink-0 min-w-0 touch-target-44 h-auto ${className}`}
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
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
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
              
              {/* Enhanced Points Display - Only load when dropdown is open */}
              {dropdownOpen && user?.id && (
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
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/en/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Your Account</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/en/orders">
            <Package className="mr-2 h-4 w-4" />
            <span>Your Orders</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/en/wishlist">
            <Heart className="mr-2 h-4 w-4" />
            <span>Your Wish List</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/en/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
