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
            
            // Enhanced profile loading with retry logic and profile creation
            const loadUserProfile = async (retries = 3) => {
              try {
                let profile = await userQueries.getProfile(user.id)
                
                // If profile doesn't exist (common with OAuth), create it
                if (!profile && retries > 0) {
                  console.log('🔧 Profile not found, creating for OAuth user:', user.id)
                  
                  try {
                    // Call API to ensure profile exists
                    const response = await fetch('/api/auth/ensure-profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        userId: user.id,
                        email: user.email,
                        metadata: user.user_metadata 
                      })
                    })
                    
                    if (response.ok) {
                      // Retry fetching profile after creation
                      await new Promise(resolve => setTimeout(resolve, 500)) // Small delay
                      profile = await userQueries.getProfile(user.id)
                    }
                  } catch (createError) {
                    console.error('Failed to create profile:', createError)
                  }
                }
                
                // If still no profile and retries left, try again
                if (!profile && retries > 0) {
                  console.log(`🔄 Retrying profile fetch (${retries} attempts left)`)
                  setTimeout(() => loadUserProfile(retries - 1), 1000)
                  return
                }
                
                // Race-condition safe check using the real store
                if (useUserStore.getState().user?.id === user.id) {
                  useUserStore.getState().setProfile(profile)
                  useCartStore.getState().setUserId(user.id)
                  useCartStore.getState().forceLoadCartForUser(user?.id)
                  
                  console.log('✅ Profile loaded successfully:', { 
                    hasProfile: !!profile, 
                    points: profile?.points_balance 
                  })
                }
              } catch (error) {
                console.error('Failed to fetch profile:', error)
                if (retries > 0) {
                  console.log(`🔄 Retrying profile fetch due to error (${retries} attempts left)`)
                  setTimeout(() => loadUserProfile(retries - 1), 1000)
                } else {
                  useUserStore.getState().setProfile(null)
                }
              }
            }
            
            // Start profile loading
            loadUserProfile()
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