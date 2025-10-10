'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { userQueries } from '@/lib/supabase/queries'
import { useIsClient } from './use-ssr-safe-store'
import { clientSideLogout } from '@/lib/security/session-manager'

/**
 * SSR-safe authentication hook
 * Provides authentication state and actions by reading from the central user store.
 */
export function useSSRSafeAuth() {
  const [loading, setLoading] = useState(true)
  const isClient = useIsClient()

  // Use SSR-safe store wrappers
  const userStore = useSSRSafeUserStore()
  const cartStore = useSSRSafeCartStore()

  // Destructure all needed state directly from the store
  const { user, profile, isHydrated, loading: profileLoading, setProfile, clearUser } = userStore
  const { clearCartOnLogout } = cartStore

  // Use memoized Supabase client to prevent redundant creation
  const supabase = useMemo(() => createClient(), [])

  // Memoize auth state to prevent unnecessary re-renders
  const authState = useMemo(() => ({
    user,
    profile,
    isAuthenticated: !!user,
    loading: loading || !isHydrated,
    profileLoading
  }), [user, profile, loading, isHydrated, profileLoading])

  // Set loading state based on hydration
  useEffect(() => {
    if (isClient && isHydrated) {
      setLoading(false)
    }
  }, [isClient, isHydrated])

  // Ensure global sign-out flag is reset when hook mounts (safety)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).signOutInProgress = false
    }
  }, [])

  // The signOut function remains the central point for initiating a logout.
  // It handles all necessary cleanup and triggers the Supabase event
  // that the AuthProvider listens for to handle the final redirect.
  const signOut = useCallback(async () => {
    if (!isClient) return

    try {
      console.log('🚪 Starting enhanced sign out process...')

      if (typeof window !== 'undefined') {
        (window as any).signOutInProgress = true
      }

      clearUser()

      if (user?.id) {
        await clientSideLogout(user.id)

        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.warn('⚠️ Server-side logout API call failed:', error)
        }
      } else {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error('Supabase sign out error:', error)
        }
      }

      await clearCartOnLogout()
      console.log('✅ Sign out cleanup completed')

    } catch (error) {
      console.error('Sign out error:', error)
      await clearCartOnLogout()
      clearUser()
      if (typeof window !== 'undefined') {
        window.location.replace('/en/auth/login')
      }
    } finally {
      if (typeof window !== 'undefined') {
        (window as any).signOutInProgress = false
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
        emailRedirectTo: `${window.location.origin}/en/auth/callback?redirectTo=/`,
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
        try {
          const { requestUtils } = await import('@/lib/utils/request-deduplication')
          requestUtils.clearUserCache(user.id)
        } catch (e) {
          console.warn('Failed to clear cached user profile after update:', e)
        }
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
  }
}