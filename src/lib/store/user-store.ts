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
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated when rehydration is complete
        if (state) {
          state.isHydrated = true
        }
      },
    }
  )
)
