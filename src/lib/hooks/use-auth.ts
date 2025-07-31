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

      if (profile) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Profile loaded successfully:', profile)
        }
        stableSetProfile(profile)
        return
      }

      // Profile doesn't exist, try to create one
      if (process.env.NODE_ENV === 'development') {
        console.log('Profile not found, attempting to create one...')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Create profile using direct Supabase insert to match schema
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || null,
            first_name: user.user_metadata?.first_name || null,
            last_name: user.user_metadata?.last_name || null,
            phone: user.user_metadata?.phone || null,
            points_balance: 1000, // Welcome bonus - 1000 points
            tier_level: 'bronze'
          })
          .select()
          .single()

        if (createError) {
          throw createError
        }

        // Add welcome bonus points transaction
        try {
          await supabase
            .from('point_transactions')
            .insert({
              user_id: user.id,
              points: 1000,
              transaction_type: 'bonus',
              reference_type: 'signup',
              description: 'Welcome bonus for new user'
            })

          if (process.env.NODE_ENV === 'development') {
            console.log('Welcome bonus transaction created for user:', user.id)
          }
        } catch (transactionError) {
          console.error('Error creating welcome bonus transaction:', transactionError)
          // Don't throw here to allow profile creation to complete
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Profile created successfully:', newProfile)
        }
        stableSetProfile(newProfile)
        return
      }

      // If we can't create a profile, set to null
      stableSetProfile(null)
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading or creating user profile:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        })
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
        // Add a small delay to ensure any logout operations have completed
        await new Promise(resolve => setTimeout(resolve, 50))

        if (!isMounted) return

        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session?.user) {
          console.log('🔐 Initial session found:', { userId: session.user.id, email: session.user.email })
          stableSetUser(session.user)
          stableSetUserId(session.user.id)
          // Load profile for authenticated user
          try {
            await loadUserProfile(session.user.id)
          } catch (profileError) {
            console.error('❌ Error loading profile during initialization:', profileError)
            // Don't break the auth flow if profile loading fails
          }
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
      if (isMounted && loading) {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('⏰ Auth loading timeout reached, setting loading to false')
        }
        setLoading(false)
        stableSetStoreLoading(false)
        if (!isHydrated) {
          stableSetHydrated(true)
        }
      }
    }, 2000)

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
          try {
            await loadUserProfile(session.user.id)
          } catch (profileError) {
            console.error('❌ Error loading profile during sign in:', profileError)
            // Don't break the auth flow if profile loading fails
          }
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

      // Clear all browser storage first
      if (typeof window !== 'undefined') {
        // Clear localStorage
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
            console.log('🧹 Clearing localStorage key:', key)
            localStorage.removeItem(key)
          }
        })

        // Clear sessionStorage
        const sessionKeys = Object.keys(sessionStorage)
        sessionKeys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
            console.log('🧹 Clearing sessionStorage key:', key)
            sessionStorage.removeItem(key)
          }
        })

        // Clear all cookies (more comprehensive approach)
        document.cookie.split(";").forEach(function(c) {
          const eqPos = c.indexOf("=")
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim()
          if (name.includes('sb-') || name.includes('supabase') || name.includes('auth')) {
            console.log('🧹 Clearing cookie:', name)
            // Clear for current domain
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
            // Clear for parent domain
            const domain = window.location.hostname.split('.').slice(-2).join('.')
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + domain
          }
        })
      }

      // Sign out from Supabase with scope 'global' to clear all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) {
        console.error('❌ Error signing out:', error)
        // Don't throw error, continue with cleanup
      }

      // Force refresh the page to ensure clean state
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }

      console.log('✅ Successfully signed out and cleared all auth data')
    } catch (error) {
      console.error('❌ Error during sign out:', error)
      // Still clear local state even if Supabase sign out fails
      clearUser()
      setUserId(null)

      // Force clear storage even on error
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        // Force refresh on error too
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }

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
        // Create profile using direct Supabase insert to match schema
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: email,
            first_name: userData?.first_name || null,
            last_name: userData?.last_name || null,
            phone: userData?.phone || null,
            points_balance: 1000, // Welcome bonus
            tier_level: 'bronze'
          })

        if (profileError) {
          throw profileError
        }
        
        // Add welcome bonus points transaction
        await supabase
          .from('point_transactions')
          .insert({
            user_id: data.user.id,
            points: 1000,
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

  const signInWithTelegram = async (telegramData: any, redirectTo?: string) => {
    try {
      console.log('🔄 Starting Telegram authentication:', { id: telegramData.id, username: telegramData.username })

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: telegramData, redirectTo }),
      })

      console.log('📡 API response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ API error response:', error)
        throw new Error(error.error || 'Telegram authentication failed')
      }

      const result = await response.json()
      console.log('✅ API success response received')
      console.log('🔍 Session tokens present:', {
        hasAccessToken: !!result.access_token,
        hasRefreshToken: !!result.refresh_token,
        hasUser: !!result.user
      })

      if (!result.access_token || !result.refresh_token) {
        console.error('❌ Missing session tokens in response')
        throw new Error('No session data received from server')
      }

      console.log('🔑 Setting session with received tokens...')

      // Set the session with the tokens from the server
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })

      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        throw new Error(`Failed to establish session: ${sessionError.message}`)
      }

      console.log('✅ Session established successfully')
      console.log('👤 Session user:', sessionData.session?.user?.id)

      // Update local auth state
      if (sessionData.session?.user) {
        setUser(sessionData.session.user)
        console.log('🔄 Loading user profile...')
        await loadUserProfile(sessionData.session.user.id)
      }

      console.log('🔄 Redirecting to:', redirectTo || '/')

      // Redirect to the intended page
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo || '/'
      }
    } catch (error) {
      console.error('❌ Telegram authentication error:', error)
      throw error
    }
  }

  const signInWithGoogle = async () => {
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
    changePassword,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: profile?.tier_level === 'platinum' // Simplified admin check
  }
}
