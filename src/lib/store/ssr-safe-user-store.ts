'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useUserStore, type UserProfile } from './user-store'
import { User } from '@supabase/supabase-js'

// Global singleton state to prevent multiple initializations
let globalIsInitialized = false
let globalUnsubscribe: (() => void) | null = null
let globalStoreState = {
  user: null as User | null,
  profile: null as UserProfile | null,
  isLoading: true,
  isHydrated: false
}

// Reset function to fully clear global singleton state on logout or account switch
export function resetSSRSafeUserSingleton() {
  try { globalUnsubscribe?.() } catch {}
  globalUnsubscribe = null
  globalIsInitialized = false
  globalStoreState = {
    user: null,
    profile: null,
    isLoading: false,
    isHydrated: false,
  }
  // Notify any listeners to re-render with cleared state
  listeners.forEach((listener) => {
    try { listener(globalStoreState) } catch {}
  })
  console.log('🧼 SSR-safe user store: Global singleton reset completed')
}

// Global state change listeners
const listeners = new Set<(state: typeof globalStoreState) => void>()

/**
 * SSR-safe wrapper for the user store
 * Returns default values during SSR and actual store values after hydration
 * Uses global singleton pattern to prevent infinite re-rendering loops
 */
export function useSSRSafeUserStore() {
  const [isClient, setIsClient] = useState(false)
  const [storeData, setStoreData] = useState(globalStoreState)
  const listenerRef = useRef<((state: typeof globalStoreState) => void) | null>(null)
  // Create stable function references using useCallback to prevent re-renders
  const setUser = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      console.log('🔄 SSR-safe wrapper: Forwarding setUser call to real store')
      return useUserStore.getState().setUser(...args)
    }
  }, [])

  const setProfile = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      console.log('🔄 SSR-safe wrapper: Forwarding setProfile call to real store')
      return useUserStore.getState().setProfile(...args)
    }
  }, [])

  const setLoading = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      return useUserStore.getState().setLoading(...args)
    }
  }, [])

  const setHydrated = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      return useUserStore.getState().setHydrated(...args)
    }
  }, [])

  const updatePoints = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      return useUserStore.getState().updatePoints(...args)
    }
  }, [])

  const updateTier = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      return useUserStore.getState().updateTier(...args)
    }
  }, [])

  const clearUser = useCallback((...args: any[]) => {
    if (typeof window !== 'undefined' && useUserStore?.getState) {
      console.log('🔄 SSR-safe wrapper: Forwarding clearUser call to real store')
      return useUserStore.getState().clearUser(...args)
    }
  }, [])



  // Initialize client state once
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Initialize global store subscription once and only once
  useEffect(() => {
    if (isClient && typeof window !== 'undefined' && !globalIsInitialized) {
      try {
        console.log('🔄 SSR-safe user store: Initializing global singleton...')

        // Additional safety check for Zustand store availability
        if (!useUserStore || typeof useUserStore.getState !== 'function') {
          console.warn('⚠️ User store not available, skipping initialization')
          return
        }

        // Mark as initialized immediately to prevent multiple subscriptions
        globalIsInitialized = true

        const data = useUserStore.getState()
        console.log('📦 SSR-safe user store: Global initial state:', {
          hasUser: !!data.user,
          hasProfile: !!data.profile,
          isHydrated: data.isHydrated
        })

        // Update global state
        globalStoreState = {
          user: data.user,
          profile: data.profile,
          isLoading: data.isLoading,
          isHydrated: data.isHydrated
        }

        // Subscribe to store changes (only once globally)
        const subscribe = useUserStore.subscribe((state) => {
          // Update global state
          globalStoreState = {
            user: state.user,
            profile: state.profile,
            isLoading: state.isLoading,
            isHydrated: state.isHydrated
          }

          // Notify all listeners
          listeners.forEach(listener => {
            try {
              listener(globalStoreState)
            } catch (error) {
              console.error('❌ Error in SSR-safe store listener:', error)
            }
          })
        })

        // Store the unsubscribe function globally
        globalUnsubscribe = subscribe

        console.log('✅ SSR-safe user store: Global singleton initialized successfully')
      } catch (error) {
        console.error('❌ Error accessing user store:', error)
        globalIsInitialized = false // Reset on error
      }
    }
  }, [isClient])

  // Subscribe to global state changes
  useEffect(() => {
    if (isClient) {
      const listener = (newState: typeof globalStoreState) => {
        setStoreData(newState)
      }

      listenerRef.current = listener
      listeners.add(listener)

      // Set initial state from global state
      setStoreData(globalStoreState)

      return () => {
        if (listenerRef.current) {
          listeners.delete(listenerRef.current)
        }
      }
    }
  }, [isClient])

  return {
    ...storeData,
    setUser,
    setProfile,
    setLoading,
    setHydrated,
    updatePoints,
    updateTier,
    clearUser
  }
}
