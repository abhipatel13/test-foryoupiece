'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '@supabase/supabase-js'

// Add version control for storage migration
const STORAGE_VERSION = 3

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
  lastValidated: number | null
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setHydrated: (hydrated: boolean) => void
  setLastValidated: (timestamp: number) => void
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
      lastValidated: null,

      setUser: (user) => {
        const current = get().user
        const sameIdentity = (current?.id ?? null) === (user?.id ?? null) && (current?.email ?? null) === (user?.email ?? null)
        if (sameIdentity) {
          console.log('⏭️ User store: no-op setUser (same identity)')
          return
        }
        console.log('🏪 User store setUser called:', { userId: user?.id, email: user?.email })
        set({ user })
        console.log('✅ User store state updated')
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

      setLastValidated: (timestamp) => {
        set({ lastValidated: timestamp })
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
          lastValidated: null,
        })
      },
    }),
    {
      name: 'foryoupiece-user',
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        // Handle storage migration when version changes
        if (version < STORAGE_VERSION) {
          console.log('🔄 Migrating user store from version', version, 'to', STORAGE_VERSION)
          // Clear old data on version mismatch to prevent conflicts
          return {
            user: null,
            profile: null,
            isLoading: false,
            isHydrated: false,
            lastValidated: null,
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
            // Initialize lastValidated if missing
            if (state.lastValidated === undefined) {
              state.lastValidated = null
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
            state.lastValidated = null
          }
        }
      },
      // Persist user authentication data for proper session management
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        lastValidated: state.lastValidated,
        // Don't persist loading states to avoid hydration issues
      }),
    }
  )
)
