// lib/providers/auth-provider.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient,resetClientCache } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
// 💡 FIX: Import the REAL Zustand stores directly.
// The AuthProvider will interact with these, and the SSR-safe hooks
// will ensure the UI components consume the state changes correctly.
import { useUserStore } from '@/lib/store/user-store' 
import { useCartStore } from '@/lib/store/cart-store'

import { userQueries } from '@/lib/supabase/queries'

// NOTE: You may need to adjust the import paths for user-store and cart-store
// if they are located elsewhere.

const AUTH_CHANNEL_NAME = 'app_auth_channel'

/**
 * AuthProvider is the single source of truth for the application's authentication state.
 * It listens for Supabase auth events and directly manipulates the underlying Zustand
 * stores. The UI components will then react to these changes via the SSR-safe hooks.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const subscribed = useRef(false)
  const router = useRouter()

  const revalidateSession = useCallback(async () => {
    console.log('[Auth Sync] Revalidating session from other tab event.')
    await supabase.auth.getSession()
  }, [supabase.auth])

  useEffect(() => {
    if (subscribed.current) return
    subscribed.current = true

    // 💡 FIX: Call methods on the real store's state.
    // This is safe because onAuthStateChange only runs on the client.
    useUserStore.getState().setLoading(true)

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)

    channel.onmessage = (event) => {
      console.log(`[Auth Sync] Received event from other tab:`, event.data.type)
      switch (event.data.type) {
        case 'SIGNED_IN':
        case 'USER_UPDATED':
          revalidateSession()
          break;
        case 'SIGNED_OUT':
          useUserStore.getState().clearUser()
          useCartStore.getState().setUserId(null)
          useCartStore.getState().clearCartOnLogout()
          break;
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any ) => {
      console.log(`[Supabase Auth] Event received: ${event}`)
      
      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN': {
          const user = session?.user
          if (user) {
            useUserStore.getState().setUser(user)
            channel.postMessage({ type: 'SIGNED_IN' })
            
            // Check if this is coming from a Google OAuth redirect (via URL params)
            const urlParams = new URLSearchParams(window.location.search)
            const fromGoogleAuth = urlParams.has('code') || window.location.pathname.includes('/auth/callback')
            
            // For Google OAuth, trigger a hard reload to ensure all data is fresh
            if (fromGoogleAuth && !(window as any).__postLoginReloadDone) {
              (window as any).__postLoginReloadDone = true
              console.log('🔄 Google OAuth completed, reloading page for fresh data...')
              // Small delay to ensure session is fully established
              setTimeout(() => {
                window.location.replace(window.location.pathname + '?r=' + Date.now())
              }, 100)
              return
            }
            
            try {
              const profile = await userQueries.getProfile(user.id)
              // Race-condition safe check using the real store
              if (useUserStore.getState().user?.id === user.id) {
                useUserStore.getState().setProfile(profile)
                useCartStore.getState().setUserId(user.id)
                useCartStore.getState().forceLoadCartForUser(user?.id)
              }
            } catch (error) {
              console.error('Failed to fetch profile:', error)
              useUserStore.getState().setProfile(null)
            }
          }
          break;
        }

        case 'SIGNED_OUT': {
          useUserStore.getState().clearUser()
          useCartStore.getState().setUserId(null)
          await useCartStore.getState().clearCartOnLogout()
          channel.postMessage({ type: 'SIGNED_OUT' })
          resetClientCache()
          router.replace('/en/auth/login')
          break;
        }

        case 'TOKEN_REFRESHED': {
          if (session?.user) {
            useUserStore.getState().setUser(session.user)
            useCartStore.getState().setUserId(session.user.id)
          } else {
            useUserStore.getState().clearUser()
            useCartStore.getState().setUserId(null)
            await useCartStore.getState().clearCartOnLogout()
            channel.postMessage({ type: 'SIGNED_OUT' })
          }
          break;
        }
        
        case 'USER_UPDATED': {
          if (session?.user) {
            useUserStore.getState().setUser(session.user)
            useCartStore.getState().setUserId(session.user.id)
            channel.postMessage({ type: 'USER_UPDATED' })
          }
          break;
        }
      }
      
      useUserStore.getState().setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      channel.close()
      subscribed.current = false
    }
  }, [revalidateSession])

  return <>{children}</>
}