'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from './use-ssr-safe-store'

/**
 * SSR-safe authentication hook
 * Provides authentication functionality without causing SSR hydration issues
 */
export function useSSRSafeAuth() {
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

  // Initialize auth state
  useEffect(() => {
    if (!isClient) return

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
          setLoading(false)
          setStoreLoading(false)
          if (isInitialLoad.current) {
            setHydrated(true)
            isInitialLoad.current = false
          }
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [isClient, supabase.auth, setUser, setUserId, loadUserProfile, forceLoadCartForUser, clearUser, setLoading, setStoreLoading, setHydrated])

  // Listen for auth changes
  useEffect(() => {
    if (!isClient) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', { event, userId: session?.user?.id })

      if (session?.user) {
        setUser(session.user)
        setUserId(session.user.id)
        await loadUserProfile(session.user.id)
        await forceLoadCartForUser(session.user.id)
      } else {
        clearUser()
      }

      setLoading(false)
      setStoreLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [isClient, supabase.auth, setUser, setUserId, loadUserProfile, forceLoadCartForUser, clearUser, setLoading, setStoreLoading])

  // Authentication methods
  const signOut = useCallback(async () => {
    if (!isClient) return

    try {
      await supabase.auth.signOut()
      clearUser()
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }, [supabase.auth, clearUser, isClient])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isClient) return

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }, [supabase.auth, isClient])

  const signUpWithEmail = useCallback(async (email: string, password: string, userData?: any) => {
    if (!isClient) return

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })

    if (error) throw error
    return data
  }, [supabase.auth, isClient])

  const signInWithGoogle = useCallback(async () => {
    if (!isClient) return

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/en/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      }
    })

    if (error) throw error
    return data
  }, [supabase.auth, isClient])





  const changePassword = useCallback(async (password: string) => {
    if (!isClient) return

    const { data, error } = await supabase.auth.updateUser({
      password
    })

    if (error) throw error
    return data
  }, [supabase.auth, isClient])

  const updateProfile = useCallback(async (updates: any) => {
    if (!isClient || !user) return

    try {
      const updatedProfile = await userQueries.updateProfile(user.id, updates)
      if (updatedProfile) {
        setProfile(updatedProfile)
      }
      return updatedProfile
    } catch (error) {
      console.error('Profile update error:', error)
      throw error
    }
  }, [user, setProfile, isClient])

  return {
    ...authState,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    changePassword,
    updateProfile,
    isAdmin: profile?.tier_level === 'platinum' // Simplified admin check
  }
}
