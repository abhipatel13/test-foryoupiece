'use client'

import { useMemo } from 'react'
import { useSSRSafeAuth } from './use-ssr-safe-auth'

/**
 * Simple authentication hook that provides userId and other common auth properties
 * This is a wrapper around useSSRSafeAuth for backward compatibility
 */
export function useAuth() {
  const auth = useSSRSafeAuth()

  return useMemo(() => ({
    // Extract userId from user object
    userId: auth.user?.id || null,
    
    // Pass through other commonly used properties
    user: auth.user,
    profile: auth.profile,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    profileLoading: auth.profileLoading,
    isAdmin: auth.isAdmin,
    
    // Pass through authentication methods
    signOut: auth.signOut,
    signInWithEmail: auth.signInWithEmail,
    signUpWithEmail: auth.signUpWithEmail,
    signInWithGoogle: auth.signInWithGoogle,
    changePassword: auth.changePassword,
    updateProfile: auth.updateProfile
  }), [auth])
}
