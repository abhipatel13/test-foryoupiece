'use client'

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from '@/lib/hooks/use-ssr-safe-store'
import { usePerformanceOptimization } from '@/lib/hooks/use-performance-optimization'

// Create auth context
const AuthContext = createContext<{
  initialized: boolean
}>({
  initialized: false
})

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const isClient = useIsClient()
  const initializationRef = useRef(false)

  // Use SSR-safe store wrappers
  const userStore = useSSRSafeUserStore()
  const cartStore = useSSRSafeCartStore()

  const { setUser, setProfile, setLoading: setStoreLoading, setHydrated, clearUser } = userStore
  const { setUserId, forceLoadCartForUser } = cartStore
  const supabase = createClient()

  // Initialize performance optimization for user data prefetching
  usePerformanceOptimization({
    prefetchUserData: true,
    prefetchPointsData: true,
    enableBackgroundRefresh: true,
    backgroundRefreshInterval: 5 * 60 * 1000 // 5 minutes
  })

  // Load user profile function
  const loadUserProfile = async (userId: string) => {
    try {
      console.log('Querying user profile for userId:', userId)
      const profile = await userQueries.getProfile(userId)
      console.log('Profile query result:', profile)

      if (profile) {
        setProfile(profile)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  // Initialize auth state once
  useEffect(() => {
    if (!isClient || initializationRef.current) return

    initializationRef.current = true
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          setUserId(session.user.id)
          await loadUserProfile(session.user.id)
          await forceLoadCartForUser(session.user.id)
        } else {
          clearUser()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (mounted) {
          setStoreLoading(false)
          setHydrated(true)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [isClient, supabase.auth, setUser, setUserId, setProfile, setStoreLoading, setHydrated, clearUser, forceLoadCartForUser])

  // Set up single auth state listener
  useEffect(() => {
    if (!isClient || !initializationRef.current) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change (centralized):', { event, userId: session?.user?.id })

      if (session?.user) {
        setUser(session.user)
        setUserId(session.user.id)
        await loadUserProfile(session.user.id)
        await forceLoadCartForUser(session.user.id)
      } else {
        clearUser()
      }

      setStoreLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [isClient, supabase.auth, setUser, setUserId, setStoreLoading, clearUser, forceLoadCartForUser])

  return (
    <AuthContext.Provider value={{ initialized: initializationRef.current }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
