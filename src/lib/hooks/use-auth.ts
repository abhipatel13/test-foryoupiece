'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from './use-ssr-safe-store'

/**
 * Main authentication hook - now SSR-safe
 * This replaces the old useAuth with SSR-safe implementation
 */
export function useAuth() {
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const isClient = useIsClient()

  // Use SSR-safe store wrappers
  const userStore = useSSRSafeUserStore()
  const cartStore = useSSRSafeCartStore()

  const { user, profile, isHydrated, setUser, setProfile, setLoading: setStoreLoading, setHydrated, clearUser } = userStore
  const { setUserId, forceLoadCartForUser } = cartStore

  const supabase = createClient()

  const isInitialLoad = useRef(true)
  const profileLoadPromise = useRef<Promise<void> | null>(null)

  // Store functions in refs to avoid dependency issues
  const storeActionsRef = useRef({
    setUser,
    setUserId,
    loadUserProfile: async () => {},
    forceLoadCartForUser,
    clearUser,
    setLoading,
    setStoreLoading: setStoreLoading,
    setHydrated
  })

  // Memoize auth state to prevent unnecessary re-renders
  const authState = useMemo(() => ({
    user,
    profile,
    isAuthenticated: !!user,
    loading: loading || !isHydrated,
    profileLoading
  }), [user, profile, loading, isHydrated, profileLoading])

  // Load user profile with caching
  const loadUserProfile = useCallback(async (userId: string, forceReload = false) => {
    if (!isClient) return

    if (profileLoadPromise.current && !forceReload) {
      return profileLoadPromise.current
    }

    setProfileLoading(true)

    profileLoadPromise.current = (async () => {
      try {
        const profileData = await userQueries.getProfile(userId)
        if (profileData) {
          setProfile(profileData)
        }
      } catch (error) {
        console.error('Failed to load user profile:', error)
      } finally {
        setProfileLoading(false)
      }
    })()

    return profileLoadPromise.current
  }, [setProfile, setProfileLoading, isClient])

  // Update refs when functions change (but don't cause re-renders)
  storeActionsRef.current = {
    setUser,
    setUserId,
    loadUserProfile,
    forceLoadCartForUser,
    clearUser,
    setLoading,
    setStoreLoading,
    setHydrated
  }

  // Initialize auth state - STABLE effect with minimal dependencies
  useEffect(() => {
    if (!isClient) return

    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        const actions = storeActionsRef.current

        if (session?.user) {
          actions.setUser(session.user)
          actions.setUserId(session.user.id)
          await actions.loadUserProfile(session.user.id)
          await actions.forceLoadCartForUser(session.user.id)
        } else {
          actions.clearUser()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (mounted) {
          const actions = storeActionsRef.current
          actions.setLoading(false)
          actions.setStoreLoading(false)
          if (isInitialLoad.current) {
            actions.setHydrated(true)
            isInitialLoad.current = false
          }
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [isClient, supabase.auth]) // ONLY depend on isClient and supabase.auth



  // Listen for auth changes - STABLE subscription with minimal dependencies
  useEffect(() => {
    if (!isClient) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', { event, userId: session?.user?.id })

      const actions = storeActionsRef.current

      if (session?.user) {
        actions.setUser(session.user)
        actions.setUserId(session.user.id)
        await actions.loadUserProfile(session.user.id)
        await actions.forceLoadCartForUser(session.user.id)
      } else {
        actions.clearUser()
      }

      actions.setLoading(false)
      actions.setStoreLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [isClient, supabase.auth]) // ONLY depend on isClient and supabase.auth
  // Sign out function
  const signOut = useCallback(async () => {
    if (!isClient) return

    try {
      setLoading(true)
      await supabase.auth.signOut()
      clearUser()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }, [isClient, supabase.auth, clearUser, setLoading])

  // Update profile function
  const updateProfile = useCallback(async (updates: any) => {
    if (!isClient || !user) return null

    try {
      setProfileLoading(true)
      const updatedProfile = await userQueries.updateProfile(user.id, updates)
      if (updatedProfile) {
        setProfile(updatedProfile)
      }
      return updatedProfile
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    } finally {
      setProfileLoading(false)
    }
  }, [isClient, user, setProfile, setProfileLoading])

  return {
    ...authState,
    signOut,
    updateProfile,
    loadUserProfile
  }
}
