'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/lib/store/user-store'
import { useCartStore } from '@/lib/store/cart-store'
import { userQueries } from '@/lib/supabase/queries'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const { user, profile, isHydrated, setUser, setProfile, setLoading: setStoreLoading, setHydrated, clearUser } = useUserStore()
  const { setUserId, forceLoadCartForUser } = useCartStore()
  const supabase = createClient()

  // Create stable references to store functions
  const stableSetUser = useCallback((user: any) => setUser(user), [])
  const stableSetProfile = useCallback((profile: any) => setProfile(profile), [])
  const stableSetStoreLoading = useCallback((loading: boolean) => setStoreLoading(loading), [])
  const stableSetHydrated = useCallback((hydrated: boolean) => setHydrated(hydrated), [])
  const stableClearUser = useCallback(() => clearUser(), [])
  const stableSetUserId = useCallback((userId: string | null) => {
    try {
      if (userId) {
        // Force load cart for authenticated user (handles both new and existing users)
        forceLoadCartForUser(userId)
      } else {
        // User logged out, just set userId to null
        setUserId(null)
      }
    } catch (error) {
      console.error('❌ Error calling cart functions:', error)
    }
  }, [])

  const loadUserProfile = useCallback(async (userId: string) => {
    // Prevent multiple concurrent profile loads for the same user
    if (profileLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Profile loading already in progress, skipping...')
      }
      return
    }

    // Check if we already have the profile for this user
    if (profile && profile.id === userId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Profile already loaded for user:', userId)
      }
      return
    }

    setProfileLoading(true)
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Loading user profile for userId:', userId)
      }
      const profile = await userQueries.getProfile(userId)
      if (process.env.NODE_ENV === 'development') {
        console.log('Profile loaded successfully:', profile)
      }
      stableSetProfile(profile)
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading user profile:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        })
      }

      // If profile doesn't exist (PGRST116 error), try to create one
      if (error?.code === 'PGRST116' || error?.message?.includes('No rows found')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Profile not found, attempting to create one...')
        }
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const newProfile = await userQueries.createProfile({
              id: user.id,
              email: user.email || null,
              first_name: user.user_metadata?.first_name || null,
              last_name: user.user_metadata?.last_name || null,
              phone: user.user_metadata?.phone || null,
              points_balance: 100, // Welcome bonus
              tier_level: 'bronze'
            })
            if (process.env.NODE_ENV === 'development') {
              console.log('Profile created successfully:', newProfile)
            }
            stableSetProfile(newProfile)
            return
          }
        } catch (createError: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating profile:', createError)
          }
        }
      }

      // Don't throw here to prevent auth flow from breaking
      stableSetProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [profileLoading, profile, stableSetProfile, supabase.auth])

  // Initialize auth state only once on mount
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session?.user) {
          console.log('🔐 Initial session found:', { userId: session.user.id, email: session.user.email })
          stableSetUser(session.user)
          stableSetUserId(session.user.id)
          // Load profile for authenticated user
          await loadUserProfile(session.user.id)
        } else if (user) {
          // If we have a persisted user but no session, clear the user
          console.log('❌ No active session found, clearing persisted user data')
          stableClearUser()
          stableSetUserId(null)
        } else {
          console.log('🔓 No session and no persisted user - unauthenticated state')
        }
      } catch (error) {
        console.error('❌ Error getting initial session:', error)
        if (isMounted) {
          // Clear user data on error
          stableClearUser()
          stableSetUserId(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          stableSetStoreLoading(false)
          // Mark as hydrated after initial session check
          if (!isHydrated) {
            stableSetHydrated(true)
          }
        }
      }
    }

    initializeAuth()

    // Ensure loading state is cleared after timeout for better UX
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('⏰ Auth loading timeout reached, setting loading to false')
        setLoading(false)
        stableSetStoreLoading(false)
        if (!isHydrated) {
          stableSetHydrated(true)
        }
      }
    }, 3000)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, []) // Empty dependency array - only run once on mount

  // Separate effect for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', { event, userId: session?.user?.id })

        if (event === 'SIGNED_IN' && session?.user) {
          stableSetUser(session.user)
          stableSetUserId(session.user.id)
          // Load profile for newly signed in user
          await loadUserProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out, clearing auth state')
          stableClearUser()
          stableSetUserId(null)
        }

        setLoading(false)
        stableSetStoreLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, []) // Empty dependency array to prevent re-subscriptions

  const signOut = async () => {
    try {
      console.log('🚪 Starting logout process')

      // Clear local state immediately
      stableClearUser()
      stableSetUserId(null)

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Error signing out:', error)
        throw error
      }

      console.log('✅ Successfully signed out')
    } catch (error) {
      console.error('❌ Error during sign out:', error)
      // Still clear local state even if Supabase sign out fails
      clearUser()
      setUserId(null)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return data
  }

  const signUpWithEmail = async (email: string, password: string, userData?: {
    first_name?: string
    last_name?: string
    phone?: string
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    
    if (error) throw error
    
    // Create user profile if signup was successful
    if (data.user) {
      try {
        await userQueries.createProfile({
          id: data.user.id,
          email: email,
          first_name: userData?.first_name || null,
          last_name: userData?.last_name || null,
          phone: userData?.phone || null,
          points_balance: 100, // Welcome bonus
          tier_level: 'bronze'
        })
        
        // Add welcome bonus points transaction
        await supabase
          .from('point_transactions')
          .insert({
            user_id: data.user.id,
            points: 100,
            transaction_type: 'bonus',
            reference_type: 'signup',
            description: 'Welcome bonus for new user'
          })
      } catch (profileError) {
        console.error('Error creating user profile:', profileError)
        // Don't throw here to allow signup to complete even if profile creation fails
      }
    }
    
    return data
  }

  const signInWithTelegram = async (telegramData: any) => {
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(telegramData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Telegram authentication failed')
    }

    const result = await response.json()

    // If we got an auth URL, redirect to it for session creation
    if (result.authUrl) {
      // Check for browser environment before redirecting
      if (typeof window !== 'undefined') {
        window.location.href = result.authUrl
      }
      return result
    }

    // Refresh the session to get the updated user
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadUserProfile(session.user.id)
    }

    return result
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    })

    if (error) throw error
    return data
  }

  const signInTemporary = async () => {
    try {
      // Create a temporary user session
      const tempEmail = `temp_${Date.now()}@foryoupiece.temp`
      const tempPassword = 'temp123456'

      // Try to sign up with temporary credentials
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: tempEmail,
        password: tempPassword,
        options: {
          data: {
            first_name: 'Guest',
            last_name: 'User',
            is_temporary: true
          }
        }
      })

      if (signUpError) {
        // If signup fails, try to sign in (user might already exist)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: tempPassword
        })

        if (signInError) throw signInError
        return signInData
      }

      return signUpData
    } catch (error) {
      console.error('Temporary sign-in error:', error)
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    // First verify the current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (verifyError) {
      throw new Error('Current password is incorrect')
    }

    // Update the password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error
  }

  const updateProfile = async (updates: {
    first_name?: string
    last_name?: string
    phone?: string
    preferred_language?: string
    marketing_consent?: boolean
    address_line_1?: string
    address_line_2?: string
    aba_bank_name?: string
  }) => {
    if (!user) throw new Error('No user logged in')

    const updatedProfile = await userQueries.updateProfile(user.id, updates)
    setProfile(updatedProfile)
    return updatedProfile
  }

  return {
    user,
    profile,
    loading,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    signInWithTelegram,
    signInWithGoogle,
    signInTemporary,
    changePassword,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: profile?.tier_level === 'platinum' // Simplified admin check
  }
}
