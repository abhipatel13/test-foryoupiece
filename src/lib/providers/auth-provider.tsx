'use client'

import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from '@/lib/hooks/use-ssr-safe-store'
import { useMultiTabSync, tabSyncUtils } from '@/lib/utils/multi-tab-sync'

import { registerAuthHandler, unregisterAuthHandler } from '@/lib/utils/auth-interceptor'

// Simplified auth provider - no complex session validation

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

  // Use SSR-safe store wrappers
  const userStore = useSSRSafeUserStore()
  const cartStore = useSSRSafeCartStore()

  const { setUser, setProfile, setLoading: setStoreLoading, setHydrated, clearUser } = userStore
  const { setUserId, forceLoadCartForUser, clearCart, clearCartOnLogout } = cartStore
  const supabase = createClient()

  // Multi-tab synchronization for authentication state
  const { broadcast } = useMultiTabSync({
    onAuthStateChange: (payload) => {
      console.log('🔄 AuthProvider: Auth state change from another tab:', payload)
      if (!payload.user && !crossTabSignOutRef.current) {
        // Another tab signed out, sign out this tab too
        console.log('🚪 AuthProvider: Signing out due to cross-tab auth change')
        crossTabSignOutRef.current = true
        handleCrossTabSignOut()
      } else if (payload.user && !userStore.user) {
        // Another tab signed in, update this tab's state
        console.log('👤 AuthProvider: Updating user state from cross-tab sign in')
        setUser(payload.user)
        setUserId(payload.user.id)
        loadUserProfile(payload.user.id)
        forceLoadCartForUser(payload.user.id)
      }
    },
    onSessionExpired: (payload) => {
      console.log('🔄 AuthProvider: Session expired in another tab:', payload)
      if (!crossTabSignOutRef.current) {
        crossTabSignOutRef.current = true
        handleCrossTabSignOut()
      }
    },
    onSessionValidated: (payload) => {
      console.log('🔄 AuthProvider: Session validated in another tab:', payload)
      // If this tab has the same user, ensure cart is loaded
      if (userStore.user?.id === payload.userId) {
        console.log('🛒 AuthProvider: Reloading cart due to cross-tab session validation')
        forceLoadCartForUser(payload.userId).catch(error => {
          console.warn('⚠️ AuthProvider: Failed to reload cart from cross-tab validation:', error)
        })
      }
    }
  })

  // Handle cross-tab sign out
  const handleCrossTabSignOut = useCallback(async () => {
    console.log('🔄 AuthProvider: Handling cross-tab sign out')
    try {
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

  // Clear all auth-related data
  const clearAllAuthData = useCallback(async () => {
    console.log('🧹 Clearing all authentication data...')
    try {
      // Clear Supabase session
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }

    if (isClient) {
      // Clear all localStorage items related to auth
      const keysToRemove = [
        'supabase.auth.token',
        'foryoupiece-user',
        'foryoupiece-cart',
        SESSION_VALIDATION_KEY
      ]

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (e) {
          console.error(`Failed to remove ${key}:`, e)
        }
      })

      // Clear any session storage
      try {
        sessionStorage.clear()
      } catch (e) {
        console.error('Failed to clear session storage:', e)
      }
    }

    // Clear Zustand stores with proper cart cleanup
    await clearCartOnLogout()
    clearUser()
  }, [supabase, clearUser, clearCartOnLogout, isClient])

  // Session expiration handler for auth interceptor
  const handleSessionExpiration = useCallback(async () => {
    console.log('🔄 Session expired, clearing user state...')
    await clearCartOnLogout()
    clearUser()
    if (isClient) {
      router.push('/en/auth/login?expired=true')
    }
  }, [clearUser, clearCartOnLogout, isClient, router])

  // Removed performance optimization hooks to improve dropdown speed

  // Load user profile function
  const loadUserProfile = async (userId: string) => {
    try {
      console.log('📋 Querying user profile for userId:', userId)
      const profile = await userQueries.getProfile(userId)
      console.log('📋 Profile query result:', profile)

      if (profile) {
        console.log('✅ Setting profile in store:', profile.id)
        setProfile(profile)
      } else {
        console.log('⚠️ No profile found for user:', userId)
        // Profile might not exist yet - this is okay for new users
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error)
      // Don't throw - profile loading failure shouldn't break authentication
    }
  }

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

    const initializeAuth = async () => {
      try {
        setIsValidating(true)
        console.log('🔍 Enhanced session restoration starting...')

        // Try multiple methods to restore session
        let session = null
        let sessionError = null

        // Method 1: Try getSession first
        try {
          const { data: sessionData, error } = await supabase.auth.getSession()
          session = sessionData.session
          sessionError = error
          console.log('🔍 getSession result:', { hasSession: !!session, error: error?.message })
        } catch (error) {
          console.warn('🔍 getSession failed:', error)
        }

        // Method 2: If no session, try getUser to validate stored tokens
        if (!session && !sessionError) {
          try {
            console.log('🔍 Trying getUser for token validation...')
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userData.user && !userError) {
              console.log('✅ Valid user found via getUser, refreshing session...')
              // Try to refresh the session
              const { data: refreshData } = await supabase.auth.refreshSession()
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

        if (session?.user && mounted) {
          console.log('👤 Session restored, setting user in store:', { id: session.user.id, email: session.user.email })

          setUser(session.user)
          setUserId(session.user.id)

          console.log('📋 Loading user profile for:', session.user.id)
          await loadUserProfile(session.user.id)

          console.log('🛒 Loading cart for user:', session.user.id)
          try {
            await forceLoadCartForUser(session.user.id)
            console.log('✅ Cart loading completed')
          } catch (cartError) {
            console.error('❌ Cart loading failed:', cartError)
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
  }, [isClient, setUser, setUserId, setProfile, setStoreLoading, setHydrated, clearUser, forceLoadCartForUser, clearCart, supabase.auth])

  // Set up auth state change listener - simplified
  useEffect(() => {
    if (!isClient || !initializationRef.current) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event)

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          // Use proper cart logout cleanup
          await clearCartOnLogout()
          clearUser()

          // Broadcast sign out to other tabs (only if not from cross-tab event)
          if (!crossTabSignOutRef.current) {
            broadcast('AUTH_STATE_CHANGE', { user: null, event })
          }

          router.push('/en/auth/login')
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('👤 Auth state change - setting user:', { id: session.user.id, email: session.user.email })
            setUser(session.user)
            setUserId(session.user.id)
            await loadUserProfile(session.user.id)
            await forceLoadCartForUser(session.user.id)

            // Broadcast sign in to other tabs
            broadcast('AUTH_STATE_CHANGE', { user: session.user, event })
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
  }, [isClient, supabase.auth, setUser, setUserId, clearUser, clearCartOnLogout, router])

  // Register auth handler for interceptor
  useEffect(() => {
    if (!isClient) return

    registerAuthHandler(handleSessionExpiration)

    return () => {
      unregisterAuthHandler()
    }
  }, [isClient, handleSessionExpiration])

  return (
    <AuthContext.Provider value={{ initialized: true, isValidating }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
