'use client'

import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, resetClientCache } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from '@/lib/hooks/use-ssr-safe-store'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'

import { registerAuthHandler, unregisterAuthHandler, authFetch, initAuthFetchGlobalPatch } from '@/lib/utils/auth-interceptor'
// import removed: useSessionMonitor not needed here; SessionMonitor component handles monitoring
import { clientSideLogout, createSession } from '@/lib/security/session-manager'
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
  if (process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
    console.log('🚀 AuthProvider component rendered!')
  }

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

  // Track profile load failures to trigger automatic recovery if stuck
  const profileFailWindowRef = useRef<{ count: number; windowStart: number; lastUserId: string }>({ count: 0, windowStart: 0, lastUserId: '' })

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
        // Ensure all same-origin fetch() calls include Authorization automatically
        initAuthFetchGlobalPatch()
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
        const { data: { session } } = await (supabaseRef.current?.auth.getSession() ?? { data: { session: null } as any })
        if (session) {
          await supabaseRef.current!.auth.signOut()
        } else {
          console.log('⏭️ Skipping duplicate signOut in cross-tab handler (no active session)')
        }
      } catch (e) {
        console.warn('⚠️ Supabase signOut check/attempt failed during cross-tab sign out:', e)
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

      // Reset Supabase client cache to prevent stale client issues
      resetClientCache()

      // Clear localStorage items
      const authKeys = [
        'supabase.auth.token',
        'foryoupiece-user',
        'foryoupiece-cart',
        'session_validated_at'
      ]

      // Hard reset authentication when profile cannot be recovered
      const forceResetAuth = useCallback(async (reason: string) => {
        try {
          console.warn('🧹 Forcing authentication reset due to:', reason)
          signOutInProgressRef.current = true
          ;(window as any).signOutInProgress = true
          try { await supabaseRef.current?.auth.signOut() } catch (e) { console.warn('⚠️ Supabase signOut during force reset:', e) }
          try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
          try { await clearCartOnLogout() } catch {}
          clearUser()
          resetClientCache()
          try { localStorage.clear() } catch {}
          try { sessionStorage.clear() } catch {}
        } finally {
          signOutInProgressRef.current = false
          if (typeof window !== 'undefined') {
            const url = '/en/auth/login?reset=1&reason=' + encodeURIComponent(reason)
            window.location.replace(url)
          } else {
            router.push('/en/auth/login?reset=1')
          }
        }
      }, [clearUser, clearCartOnLogout, router])

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
        try { if (typeof window !== 'undefined') { (window as any).signOutInProgress = false } } catch {}
      }, 200)
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

      // Reset Supabase client cache to prevent stale client issues
      resetClientCache()

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

  // Optimized user profile loading with faster caching and reduced delays
  const profileLoadTimestampRef = useRef<number>(0)
  const loadUserProfile = async (userId: string) => {
    if (profileLoadInFlightRef.current === userId) {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('⏭️ Skipping duplicate profile load for:', userId)
      }
      return
    }

    // Reduce cache time to 2 minutes for faster updates
    const timeSinceLastLoad = Date.now() - profileLoadTimestampRef.current
    if (timeSinceLastLoad < 120000) { // 2 minutes instead of 5
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('📋 Profile recently loaded, skipping reload for user:', userId)
      }
      return
    }

    profileLoadInFlightRef.current = userId
    try {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('📋 Querying user profile for userId:', userId)
      }

      // Proactively ensure a profile exists before fetching it (handles new users across all providers)
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 2000)
        await authFetch('/api/auth/ensure-profile', { method: 'POST', cache: 'no-store', signal: controller.signal })
        clearTimeout(t)
      } catch (e) {
        console.warn('⚠️ ensure-profile prefetch failed (non-fatal):', e)
      }

      // Use optimized profile loading via lightweight bootstrap API with soft timeout and background retry
      const profilePromise = (async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 6000)
        try {
          const resp = await fetch('/api/profile/bootstrap', {
            cache: 'no-store',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          })
          const json = await resp.json().catch(() => null)
          return json?.data?.profile ?? null
        } catch (_e) {
          return null
        } finally {
          clearTimeout(timer)
        }
      })()

      const softTimeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => {
          console.warn('⏰ Profile load exceeded 5-6s, continuing with background retry...')
          resolve(null) // Soft timeout - resolve with null instead of rejecting
        }, 6000)
      )

      const profile = await Promise.race([profilePromise, softTimeoutPromise])

      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('📋 Profile query result:', profile)
      }

      if (profile) {
        if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
          console.log('✅ Setting profile in store:', profile.id)
        }
        setProfile(profile)
        profileLoadTimestampRef.current = Date.now()
      } else {
        // Handle soft timeout case - schedule background retry and track failures for auto-recovery
        if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
          console.log('⚠️ Profile load timed out or no profile found, scheduling background retry...')
        }

        // Update failure window (1 minute window, 3+ misses triggers reset)
        const now = Date.now()
        const win = profileFailWindowRef.current
        if (win.lastUserId !== userId || now - win.windowStart > 60000) {
          profileFailWindowRef.current = { count: 1, windowStart: now, lastUserId: userId }
        } else {
          win.count += 1
        }

        // If repeated failures, force a clean sign-out so user can re-authenticate
        if (profileFailWindowRef.current.count >= 3) {
          await forceResetAuth('profile_bootstrap_failed')
          return
        }

        // Schedule background retry with exponential backoff
        setTimeout(async () => {
          try {
            const retryProfile = await userQueries.getProfile(userId)
            if (retryProfile && profileLoadInFlightRef.current === userId) {
              if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
                console.log('✅ Background retry successful, setting profile:', retryProfile.id)
              }
              setProfile(retryProfile)
              profileLoadTimestampRef.current = Date.now()
              // success: reset failure window
              profileFailWindowRef.current = { count: 0, windowStart: Date.now(), lastUserId: userId }
            } else {
              // escalate count and possibly force reset
              const now2 = Date.now()
              const win2 = profileFailWindowRef.current
              if (win2.lastUserId !== userId || now2 - win2.windowStart > 60000) {
                profileFailWindowRef.current = { count: 1, windowStart: now2, lastUserId: userId }
              } else {
                win2.count += 1
              }
              if (profileFailWindowRef.current.count >= 3) {
                await forceResetAuth('profile_retry_failed')
              }
            }
          } catch (retryError) {
            console.warn('⚠️ Background profile retry failed:', retryError)
            if (profileFailWindowRef.current.count >= 3) {
              await forceResetAuth('profile_retry_exception')
            }
          }
        }, 2000) // 2 second retry delay
      }
    } catch (error) {
      // Downgrade expected timeouts from error to warn to reduce Sentry noise
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('⚠️ Profile load timeout (expected on slow networks):', error.message)
      } else {
        console.error('❌ Error loading user profile:', error)
      }
      // Don't throw - profile loading failure shouldn't break authentication
    } finally {
      // Reduce debounce time for faster subsequent loads
      setTimeout(() => {
        if (profileLoadInFlightRef.current === userId) profileLoadInFlightRef.current = null
      }, 500) // Reduced from 1000ms to 500ms
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
      // Ensure cart loads even if setUserId no-ops due to same user on reload
      const prevCartUserId = cartStore.userId
      if (prevCartUserId === payload.user.id) {
        forceLoadCartForUser(payload.user.id).catch(err => console.warn('⚠️ Cross-tab: forceLoadCartForUser failed:', err))
      }
      loadUserProfile(payload.user.id)
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

          // Initialize in-memory session tracker for validation endpoints
          try {
            createSession(session.user.id)
          } catch (e) {
            console.warn('⚠️ Failed to create client session state:', e)
          }

          // Load profile and cart in parallel for better performance
          console.log('📋 Loading user data in parallel for:', session.user.id)
          try {
            // If cart store already has same userId (rehydrated on reload), setUserId will no-op.
            // In that case explicitly force-load the cart to fix the reload issue.
            const prevCartUserId = cartStore.userId
            await Promise.all([
              loadUserProfile(session.user.id),
              prevCartUserId === session.user.id
                ? forceLoadCartForUser(session.user.id)
                : Promise.resolve()
            ])
          } catch (error) {
            console.error('❌ Parallel data loading failed:', error)
            // Don't fail auth if data loading fails
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

        // Properly handle INITIAL_SESSION to immediately hydrate UI after OAuth redirects
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            const sameUser = currentUserRef.current?.id === session.user.id
            if (sameUser) {
              console.log('⏭️ Skipping duplicate INITIAL_SESSION handling for same user')
            } else {
              console.log('👤 INITIAL_SESSION - setting user:', { id: session.user.id, email: session.user.email })
              setUser(session.user)
              setUserId(session.user.id)

              try {
                createSession(session.user.id)
              } catch (e) {
                console.warn('⚠️ Failed to create client session state (INITIAL_SESSION):', e)
              }

              await loadUserProfile(session.user.id)
            }

            // Broadcast initial session to other tabs in case they're open
            broadcast('AUTH_STATE_CHANGE', { user: session.user, event })
          }
          setStoreLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          // Set local logout flag to prevent race conditions
          signOutInProgressRef.current = true

          // Use proper cart logout cleanup
          await clearCartOnLogout()
          clearUser()

          // Reset Supabase client cache to prevent stale client issues
          resetClientCache()

          // Broadcast sign out to other tabs (only if not from cross-tab event)
          if (!crossTabSignOutRef.current) {
            broadcast('AUTH_STATE_CHANGE', { user: null, event })
          }

          // Reset logout flag after cleanup (further reduced to 100ms to minimize race window)
          setTimeout(() => {
            signOutInProgressRef.current = false
            try { if (typeof window !== 'undefined') { (window as any).signOutInProgress = false } } catch {}
          }, 100)

          router.push('/en/auth/login')
        } else if (event === 'SIGNED_IN') {
          // If a logout guard is active but we received SIGNED_IN, clear it and proceed
          const globalSignOutFlag = typeof window !== 'undefined' ? (window as any).signOutInProgress : false
          if (signOutInProgressRef.current || globalSignOutFlag) {
            console.log('✅ SIGNED_IN received during logout guard; clearing guard and proceeding')
            signOutInProgressRef.current = false
            try { if (typeof window !== 'undefined') { (window as any).signOutInProgress = false } } catch {}
            // continue without early return
          }

          if (session?.user) {
            const sameUser = currentUserRef.current?.id === session.user.id
            if (sameUser) {
              console.log('⏭️ Skipping duplicate SIGNED_IN handling for same user')
            } else {
              console.log('👤 Auth state change - setting user:', { id: session.user.id, email: session.user.email })
              setUser(session.user)
              setUserId(session.user.id)

              // Initialize in-memory session tracker for validation endpoints
              try {
                createSession(session.user.id)
              } catch (e) {
                console.warn('⚠️ Failed to create client session state:', e)
              }

              // Proactively ensure a users row exists for new accounts (covers Google/Telegram/email)
              try {
                const controller = new AbortController()
                const t = setTimeout(() => controller.abort(), 2000)
                await authFetch('/api/auth/ensure-profile', { method: 'POST', cache: 'no-store', signal: controller.signal })
                clearTimeout(t)
              } catch (e) {
                console.warn('⚠️ ensure-profile POST failed (non-fatal):', e)
              }

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
