'use client'

import { useEffect, useState } from 'react'
import { useUserStore, type UserProfile } from './user-store'
import { User } from '@supabase/supabase-js'

/**
 * SSR-safe wrapper for the user store
 * Returns default values during SSR and actual store values after hydration
 */
export function useSSRSafeUserStore() {
  const [isClient, setIsClient] = useState(false)
  const [storeData, setStoreData] = useState({
    user: null as User | null,
    profile: null as UserProfile | null,
    isLoading: true,
    isHydrated: false,
    setUser: () => {},
    setProfile: () => {},
    setLoading: () => {},
    setHydrated: () => {},
    updatePoints: () => {},
    updateTier: () => {},
    clearUser: () => {}
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (isClient) {
      try {
        const data = useUserStore.getState()
        const subscribe = useUserStore.subscribe((state) => {
          setStoreData({
            user: state.user,
            profile: state.profile,
            isLoading: state.isLoading,
            isHydrated: state.isHydrated,
            setUser: state.setUser,
            setProfile: state.setProfile,
            setLoading: state.setLoading,
            setHydrated: state.setHydrated,
            updatePoints: state.updatePoints,
            updateTier: state.updateTier,
            clearUser: state.clearUser
          })
        })

        // Set initial state
        setStoreData({
          user: data.user,
          profile: data.profile,
          isLoading: data.isLoading,
          isHydrated: data.isHydrated,
          setUser: data.setUser,
          setProfile: data.setProfile,
          setLoading: data.setLoading,
          setHydrated: data.setHydrated,
          updatePoints: data.updatePoints,
          updateTier: data.updateTier,
          clearUser: data.clearUser
        })

        return subscribe
      } catch (error) {
        console.warn('Error accessing user store:', error)
      }
    }
  }, [isClient])

  return storeData
}
