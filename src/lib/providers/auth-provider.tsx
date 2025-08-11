'use client'

import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from '@/lib/hooks/use-ssr-safe-store'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'

import { registerAuthHandler, unregisterAuthHandler } from '@/lib/utils/auth-interceptor'
// import removed: useSessionMonitor not needed here; SessionMonitor component handles monitoring
import { clientSideLogout } from '@/lib/security/session-manager'
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js'

// Enhanced auth provider with session monitoring

// Create auth context
const AuthContext = createContext<{
  initialized: boolean
  isValidating: boolean
}>({
  initialized: false,
  isValidating: true
})

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  console.log('🚀 AuthProvider component rendered!')

  const router = useRouter()
  const isClient = useIsClient()
  const initializationRef = useRef(false)
  const [isValidating, setIsValidating] = useState(true)
  const crossTabSignOutRef = useRef(false)
  const signOutInProgressRef = useRef(false)

  // Stable refs to reduce re-renders and duplicate work
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const currentUserRef = useRef<ReturnType<typeof useSSRSafeUserStore>['user']>(null)
  const profileLoadInFlightRef = useRef<string | null>(null)

  // Throttle repeated cross-tab cart reloads
  const lastCrossTabCartReloadRef = useRef(0)

  // Use SSR-safe store wrappers
  const userStore = useSSRSafeUserStore()
  const cartStore = useSSRSafeCartStore()

  const { setUser, setProfile, setLoading: setStoreLoading, setHydrated, clearUser } = userStore
  const { setUserId, forceLoadCartForUser, clearCart, clearCartOnLogout } = cartStore

  // Initialize a single Supabase client on the client only with browser-specific handling
  useEffect(() => {
    if (isClient && !supabaseRef.current) {
      try {
        supabaseRef.current = createClient()
        console.log('✅ Supabase client initialized successfully')
      } catch (e) {
        console.error('❌ Failed to create Supabase client:', e)

        // Browser-specific error handling
        if (e instanceof Error) {
          if (e.message.includes('localStorage') || e.message.includes('storage')) {
            console.warn('🔒 Storage access blocked - this may be due to private browsing mode or strict privacy settings')
          }

          if (e.message.includes('network') || e.message.includes('fetch')) {
            console.warn('🌐 Network error - check internet connection and firewall settings')
          }
        }
      }
    }
  }, [isClient])

  // Track current user in a ref to avoid coupling callbacks to store deps
  useEffect(() => {
    currentUserRef.current = userStore.user
  }, [userStore.user])

  // Session monitoring is performed by <SessionMonitor /> at layout level to avoid duplication

  // Handle cross-tab sign out (defined first to avoid circular dependency)
  const handleCrossTabSignOut = useCallback(async () => {
    console.log('🔄 AuthProvider: Handling cross-tab sign out')
    try {
      // Sign out from Supabase first to clear cookies/tokens
      try {
        await supabaseRef.current?.auth.signOut()
      } catch (e) {
        console.warn('⚠️ Supabase signOut failed during cross-tab sign out:', e)
      }

      // Best-effort server-side logout for token blacklisting
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e) {
        console.warn('⚠️ Server-side logout API call failed during cross-tab sign out:', e)
      }

      // Clear Zustand stores with proper cart cleanup
      await clearCartOnLogout()
      clearUser()

      // Clear localStorage items
      const authKeys = [
        'supabase.auth.token',
        'foryoupiece-user',
        'foryoupiece-cart',
        'session_validated_at'
      ]

      authKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (e) {
          console.error(`Failed to remove ${key}:`, e)
        }
      })

      if (isClient) {
        router.push('/en/auth/login?expired=true')
      }
    } catch (error) {
      console.error('❌ Cross-tab sign out error:', error)
    } finally {
      // Reset the flag after a delay to allow for future cross-tab events
      setTimeout(() => {
        crossTabSignOutRef.current = false
      }, 1000)
    }
  }, [clearUser, clearCartOnLogout, isClient, router])



  // Session expiration handler for auth interceptor
  const handleSessionExpiration = useCallback(async () => {
    console.log('🔄 Session expired, performing complete logout...')
    try {
      // Prefer consistent client-side logout for cleanup and Supabase sign out
      const currentUserId = currentUserRef.current?.id
      if (currentUserId) {
        const result = await clientSideLogout(currentUserId)
        if (!result.success) {
          console.warn('⚠️ clientSideLogout reported failure:', result.error)
        }
      } else {
        // Fallback to direct Supabase sign out
        try {
          await supabaseRef.current?.auth.signOut()
        } catch (e) {
          console.warn('⚠️ Supabase signOut failed during session expiration:', e)
        }
      }

      // Best-effort server-side logout for token blacklisting
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e) {
        console.warn('⚠️ Server-side logout API call failed during session expiration:', e)
      }

      // Clear stores
      await clearCartOnLogout()
      clearUser()

      if (isClient) {
        router.push('/en/auth/login?expired=true')
      }
    } catch (error) {
      console.error('❌ Session expiration handler error:', error)
      // Ensure redirect even on error
      if (isClient) {
        router.push('/en/auth/login?expired=true')
      }
    }
  }, [clearUser, clearCartOnLogout, isClient, router])

  // Removed performance optimization hooks to improve dropdown speed

  // Load user profile with enhanced caching and deduplication
  const profileLoadTimestampRef = useRef<number>(0)
  const loadUserProfile = async (userId: string) => {
    if (profileLoadInFlightRef.current === userId) {
      console.log('⏭️ Skipping duplicate profile load for:', userId)
      return
    }

    // Check if profile was loaded recently (within 5 minutes)
    const timeSinceLastLoad = Date.now() - profileLoadTimestampRef.current
    if (timeSinceLastLoad < 300000) { // 5 minutes
      console.log('📋 Profile recently loaded, skipping reload for user:', userId)
      return
    }

    profileLoadInFlightRef.current = userId
    try {
      console.log('📋 Querying user profile for userId:', userId)
      const profile = await userQueries.getProfile(userId)
      console.log('📋 Profile query result:', profile)

      if (profile) {
        console.log('✅ Setting profile in store:', profile.id)
        setProfile(profile)
        profileLoadTimestampRef.current = Date.now() // Track when profile was loaded
      } else {
        console.log('⚠️ No profile found for user:', userId)
        // Profile might not exist yet - this is okay for new users
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error)
      // Don't throw - profile loading failure shouldn't break authentication
    } finally {
      // Allow future profile loads for same user after a brief debounce
      setTimeout(() => {
        if (profileLoadInFlightRef.current === userId) profileLoadInFlightRef.current = null
      }, 1000)
    }
  }

  // Memoized callback functions to prevent re-rendering loops
  const handleAuthStateChange = useCallback((payload: any) => {
    console.log('🔄 AuthProvider: Auth state change from another tab:', payload)
    if (!payload.user && !crossTabSignOutRef.current) {
      console.log('🚪 AuthProvider: Signing out due to cross-tab auth change')
      crossTabSignOutRef.current = true
      handleCrossTabSignOut()
    } else if (payload.user && !currentUserRef.current) {
      console.log('👤 AuthProvider: Updating user state from cross-tab sign in')
      setUser(payload.user)
      setUserId(payload.user.id)
      loadUserProfile(payload.user.id)
      // Avoid immediate duplicate cart load; setUserId triggers loadCartFromDatabase
    }
  }, [setUser, setUserId, handleCrossTabSignOut, forceLoadCartForUser])

  const handleSessionExpiredCallback = useCallback((payload: any) => {
    console.log('🔄 AuthProvider: Session expired in another tab:', payload)
    if (!crossTabSignOutRef.current) {
      crossTabSignOutRef.current = true
      handleCrossTabSignOut()
    }
  }, [handleCrossTabSignOut])

  const handleSessionValidated = useCallback((payload: any) => {
    console.log('🔄 AuthProvider: Session validated in another tab:', payload)
    if (currentUserRef.current?.id === payload.userId) {
      const now = Date.now()
      // Avoid redundant reloads within 5 seconds window
      if (now - lastCrossTabCartReloadRef.current < 5000) {
        console.log('⏭️ AuthProvider: Skipping duplicate cart reload (throttled)')
        return
      }
      lastCrossTabCartReloadRef.current = now
      console.log('🛒 AuthProvider: Reloading cart due to cross-tab session validation')
      forceLoadCartForUser(payload.userId).catch(error => {
        console.warn('⚠️ AuthProvider: Failed to reload cart from cross-tab validation:', error)
      })
    }
  }, [forceLoadCartForUser])

  // Multi-tab synchronization for authentication state (stable configuration)
  const multiTabConfig = useMemo(() => ({
    onAuthStateChange: handleAuthStateChange,
    onSessionExpired: handleSessionExpiredCallback,
    onSessionValidated: handleSessionValidated
  }), [handleAuthStateChange, handleSessionExpiredCallback, handleSessionValidated])

  const { broadcast } = useMultiTabSync(multiTabConfig)

  // Initialize auth state once - simplified approach
  useEffect(() => {
    console.log('🔍 Auth provider useEffect triggered:', { isClient, initialized: initializationRef.current })

    if (!isClient || initializationRef.current) {
      console.log('❌ Not client-side or already initialized, skipping auth initialization')
      return
    }

    console.log('✅ Starting simplified auth initialization...')
    initializationRef.current = true
    let mounted = true

    // Reset global sign-out flag on page load
    if (typeof window !== 'undefined') {
      (window as any).signOutInProgress = false
      console.log('🔁 Global sign-out flag reset on mount')
    }

    const initializeAuth = async () => {
      try {
        setIsValidating(true)
        console.log('🔍 Enhanced session restoration starting...')

        // Check if sign-out is in progress (local or global flag)
        const globalSignOutFlag = typeof window !== 'undefined' ? (window as any).signOutInProgress : false
        if (signOutInProgressRef.current || globalSignOutFlag) {
          console.log('🚪 Sign-out in progress, skipping session restoration')
          // Sync local flag with global flag
          if (globalSignOutFlag) {
            signOutInProgressRef.current = true
          }
          if (mounted) {
            clearUser()
            clearCart()
            setStoreLoading(false)
            setHydrated(true)
            setIsValidating(false)
          }
          return
        }

        // Try multiple methods to restore session
        let session = null
        let sessionError = null

        // Method 1: Try getSession first with browser-specific error handling
        try {
          const { data: sessionData, error } = await supabaseRef.current?.auth.getSession() ?? { data: { session: null }, error: null as any }
          session = sessionData.session
          sessionError = error
          console.log('🔍 getSession result:', { hasSession: !!session, error: error?.message })
        } catch (error) {
          console.warn('🔍 getSession failed:', error)

          // Browser-specific error handling
          if (error instanceof Error) {
            if (error.message.includes('localStorage') || error.message.includes('storage')) {
              console.warn('🦊 Storage access issue detected - may be Firefox private browsing or strict privacy settings')
            }

            if (error.message.includes('network') || error.message.includes('fetch')) {
              console.warn('🌐 Network connectivity issue during session restoration')
            }
          }
        }

        // Method 2: If no session, try getUser to validate stored tokens
        if (!session && !sessionError) {
          try {
            console.log('🔍 Trying getUser for token validation...')
            const { data: userData, error: userError } = await supabaseRef.current?.auth.getUser() ?? { data: { user: null }, error: null as any }
            if (userData.user && !userError) {
              console.log('✅ Valid user found via getUser, refreshing session...')
              // Try to refresh the session
              const { data: refreshData } = await supabaseRef.current!.auth.refreshSession()
              session = refreshData.session
            }
          } catch (error) {
            console.warn('🔍 getUser validation failed:', error)
          }
        }

        if (sessionError && !session) {
          console.error('❌ Session error:', sessionError)
          if (mounted) {
            clearUser()
            clearCart()
          }
          return
        }

        // Double-check sign-out status before setting user (local or global flag)
        const globalSignOutFlagCheck = typeof window !== 'undefined' ? (window as any).signOutInProgress : false
        if (signOutInProgressRef.current || globalSignOutFlagCheck) {
          console.log('🚪 Sign-out detected during session restoration, aborting')
          if (mounted) {
            clearUser()
            clearCart()
          }
          return
        }

        if (session?.user && mounted) {
          console.log('👤 Session restored, setting user in store:', { id: session.user.id, email: session.user.email })

          setUser(session.user)
          setUserId(session.user.id)

          console.log('📋 Loading user profile for:', session.user.id)
          await loadUserProfile(session.user.id)

          console.log('🛒 Loading cart for user:', session.user.id)
          try {
            // setUserId already triggers loadCartFromDatabase; avoid duplicate loads
            // await forceLoadCartForUser(session.user.id)
            console.log('⏭️ Skipping explicit forceLoadCartForUser to avoid duplicates')
          } catch (cartError) {
            console.error('❌ Cart loading failed (unexpected):', cartError)
            // Don't fail auth if cart loading fails
          }

          console.log('✅ User authentication setup complete')
        } else if (mounted) {
          console.log('❌ No valid session found, clearing user data')
          clearUser()
          clearCart()
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          clearUser()
          clearCart()
        }
      } finally {
        console.log('🏁 Auth initialization finally block:', { mounted })
        if (mounted) {
          setStoreLoading(false)
          setHydrated(true)
          setIsValidating(false)
        }
      }
    }

    initializeAuth()

    return () => {
      console.log('🧹 Auth provider cleanup, setting mounted = false')
      mounted = false
    }
  }, [isClient, setUser, setUserId, setProfile, setStoreLoading, setHydrated, clearUser, forceLoadCartForUser, clearCart])

  // Set up auth state change listener - simplified
  useEffect(() => {
    if (!isClient || !initializationRef.current || !supabaseRef.current) return

    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: SupabaseSession | null) => {
        console.log('🔄 Auth state change:', event)

        // Ignore initial session event to avoid duplicating initialization work
        if (event === 'INITIAL_SESSION') {
          return
        }

        if (event === 'SIGNED_OUT') {
          // Set local logout flag to prevent race conditions
          signOutInProgressRef.current = true

          // Use proper cart logout cleanup
          await clearCartOnLogout()
          clearUser()

          // Broadcast sign out to other tabs (only if not from cross-tab event)
          if (!crossTabSignOutRef.current) {
            broadcast('AUTH_STATE_CHANGE', { user: null, event })
          }

          // Reset logout flag after cleanup
          setTimeout(() => {
            signOutInProgressRef.current = false
          }, 1000)

          router.push('/en/auth/login')
        } else if (event === 'SIGNED_IN') {
          // Check if logout is in progress - ignore SIGNED_IN during logout
          const globalSignOutFlag = typeof window !== 'undefined' ? (window as any).signOutInProgress : false
          if (signOutInProgressRef.current || globalSignOutFlag) {
            console.log('🚪 Ignoring SIGNED_IN event during logout process')
            return
          }

          if (session?.user) {
            const sameUser = currentUserRef.current?.id === session.user.id
            if (sameUser) {
              console.log('⏭️ Skipping duplicate SIGNED_IN handling for same user')
            } else {
              console.log('👤 Auth state change - setting user:', { id: session.user.id, email: session.user.email })
              setUser(session.user)
              setUserId(session.user.id)
              await loadUserProfile(session.user.id)
              // Only force cart reload when user actually changed
              // setUserId already triggers cart load; avoid duplicate
            }

            // Broadcast sign in to other tabs
            broadcast('AUTH_STATE_CHANGE', { user: session.user, event })
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refreshed should not churn user state if identity is unchanged
          if (session?.user) {
            const sameUser = currentUserRef.current?.id === session.user.id
            if (sameUser) {
              console.log('⏭️ Skipping store update/broadcast on TOKEN_REFRESHED for same user')
              // No user/profile/cart updates or cross-tab broadcast needed
              // Supabase autoRefresh keeps tokens valid; UI state remains stable
              return
            }
            // In rare cases the user object changes (e.g., anon->auth), update accordingly
            console.log('👤 TOKEN_REFRESHED with different user, updating state:', { id: session.user.id, email: session.user.email })
            setUser(session.user)
            setUserId(session.user.id)
            await loadUserProfile(session.user.id)
            // Do not broadcast TOKEN_REFRESHED as AUTH_STATE_CHANGE to avoid cross-tab loops
          }
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            setUser(session.user)
            await loadUserProfile(session.user.id)

            // Broadcast user update to other tabs
            broadcast('AUTH_STATE_CHANGE', { user: session.user, event })
          }
        }

        setStoreLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [isClient, setUser, setUserId, clearUser, clearCartOnLogout, router])

  // Register auth handler for interceptor
  useEffect(() => {
    if (!isClient) return

    registerAuthHandler(handleSessionExpiration)

    return () => {
      unregisterAuthHandler()
    }
  }, [isClient, handleSessionExpiration])

  const contextValue = useMemo(() => ({ initialized: true, isValidating }), [isValidating])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
