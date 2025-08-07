'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from './use-ssr-safe-store'
import { clientSideLogout } from '@/lib/security/session-manager'

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
  const { setUserId, forceLoadCartForUser, clearCartOnLogout } = cartStore
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

  // Load user profile with enhanced caching and deduplication
  const loadUserProfile = useCallback(async (userId: string, forceReload = false) => {
    if (!isClient) return

    // Check if we already have a valid profile for this user
    if (profile && profile.id === userId && !forceReload) {
      return Promise.resolve()
    }

    if (profileLoadPromise.current && !forceReload) {
      return profileLoadPromise.current
    }

    setProfileLoading(true)

    profileLoadPromise.current = (async () => {
      try {
        // Use request deduplication for better performance
        const { requestUtils } = await import('@/lib/utils/request-deduplication')
        const profileData = await requestUtils.fetchUserProfile(userId)

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
  }, [setProfile, setProfileLoading, isClient, profile])

  // Set loading state based on hydration
  useEffect(() => {
    if (isClient && isHydrated) {
      setLoading(false)
    }
  }, [isClient, isHydrated])

  // Session expiration detection and automatic sign-out
  const handleSessionExpiration = useCallback(async () => {
    if (!isClient) return

    try {
      console.log('🔄 Session expired, signing out automatically...')
      await supabase.auth.signOut()
      clearUser()

      // Optionally redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/en/auth/login?expired=true'
      }
    } catch (error) {
      console.error('Auto sign out error:', error)
      // Force clear user state even if sign out fails
      clearUser()
    }
  }, [supabase.auth, clearUser, isClient])

  // Enhanced sign out with complete cleanup and token blacklisting
  const signOut = useCallback(async () => {
    if (!isClient) return

    try {
      console.log('🚪 Starting enhanced sign out process...')

      // Set global sign-out flag to prevent session restoration
      if (typeof window !== 'undefined') {
        (window as any).signOutInProgress = true
      }

      // Clear user state immediately to prevent UI confusion
      clearUser()

      // Use client-side logout for immediate cleanup
      if (user?.id) {
        const logoutResult = await clientSideLogout(user.id)
        if (logoutResult.success) {
          console.log('✅ Client-side logout completed successfully')
        } else {
          console.error('❌ Client-side logout failed:', logoutResult.error)
          // Continue with fallback cleanup
        }

        // Also call server-side logout API for token blacklisting
        try {
          const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })

          if (response.ok) {
            console.log('✅ Server-side logout completed successfully')
          } else {
            console.warn('⚠️ Server-side logout failed, but continuing with client cleanup')
          }
        } catch (error) {
          console.warn('⚠️ Server-side logout API call failed:', error)
          // Continue with client-side cleanup even if server call fails
        }
      } else {
        // Fallback to basic Supabase logout
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error('Supabase sign out error:', error)
        }
      }

      // Clear Zustand stores with proper cart cleanup
      await clearCartOnLogout()
      clearUser()

      console.log('✅ Sign out cleanup completed')

      // Force redirect to login with immediate page reload
      if (typeof window !== 'undefined') {
        // Use replace to prevent back button issues and force immediate redirect
        window.location.replace('/en/auth/login')
      }
    } catch (error) {
      console.error('Sign out error:', error)
      // Force cleanup even on error
      await clearCartOnLogout()
      clearUser()
      if (typeof window !== 'undefined') {
        window.location.replace('/en/auth/login')
      }
    }
  }, [supabase.auth, clearUser, clearCartOnLogout, isClient, user?.id])

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
    handleSessionExpiration,
    isAdmin: profile?.tier_level === 'platinum' // Simplified admin check
  }
}
