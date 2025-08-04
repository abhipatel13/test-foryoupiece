'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@supabase/supabase-js'

export type UserProfile = {
  id: string
  email: string | null
  phone: string | null
  telegram_id: string | null
  telegram_username: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  points_balance: number
  tier: string
  created_at: string
  updated_at: string
}

type UserStore = {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isHydrated: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setHydrated: (hydrated: boolean) => void
  updatePoints: (points: number) => void
  updateTier: (tier: string) => void
  clearUser: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      isHydrated: false,

      setUser: (user) => {
        set({ user })
      },

      setProfile: (profile) => {
        set({ profile })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setHydrated: (isHydrated) => {
        set({ isHydrated })
      },

      updatePoints: (points) => {
        const { profile } = get()
        if (profile) {
          set({
            profile: {
              ...profile,
              points,
            },
          })
        }
      },

      updateTier: (tier) => {
        const { profile } = get()
        if (profile) {
          set({
            profile: {
              ...profile,
              tier,
            },
          })
        }
      },

      clearUser: () => {
        set({
          user: null,
          profile: null,
          isLoading: false,
        })
      },
    }),
    {
      name: 'foryoupiece-user',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration from older versions
        if (version === 0) {
          // Reset state for version 0 to 1 migration
          return {
            user: null,
            profile: null,
            isLoading: false,
            isHydrated: false,
          }
        }
        return persistedState
      },
      onRehydrateStorage: () => (state) => {
        try {
          // Mark as hydrated when rehydration is complete
          if (state) {
            state.isHydrated = true
            // Ensure loading state is reset on hydration
            if (state.isLoading === undefined) {
              state.isLoading = false
            }
          }
        } catch (error) {
          console.warn('User store hydration error:', error)
          // Reset to safe defaults on hydration error
          if (state) {
            state.user = null
            state.profile = null
            state.isLoading = false
            state.isHydrated = true
          }
        }
      },
      // Add error handling for storage operations
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        // Don't persist loading or hydration states
      }),
    }
  )
)
