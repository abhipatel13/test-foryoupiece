'use client'

import { useEffect, useRef, useState } from 'react'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { createClient } from '@/lib/supabase/client'

interface SessionMonitorProps {
  checkInterval?: number // in milliseconds
  enabled?: boolean
  maxRetries?: number // Maximum retry attempts for failed validations
}

/**
 * Enhanced Session Monitor Component
 * Continuously monitors session health, automatically signs out on invalid sessions,
 * and coordinates session state across multiple browser tabs
 */
export function SessionMonitor({
  checkInterval = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  maxRetries = 3
}: SessionMonitorProps) {
  const { user, signOut } = useSSRSafeAuth()
  const { forceLoadCartForUser } = useSSRSafeCartStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCheckingRef = useRef(false)
  const retryCountRef = useRef(0)
  const [lastValidationTime, setLastValidationTime] = useState<number>(0)
  // Throttle repeated cart reloads from cross-tab SESSION_VALIDATED
  const lastCrossTabCartReloadRef = useRef(0)

  // Multi-tab synchronization for session management
  const { broadcast } = useMultiTabSync({
    onAuthStateChange: (payload) => {
      console.log('🔄 SessionMonitor: Auth state change from another tab:', payload)
      if (!payload.user) {
        // Another tab signed out, sign out this tab too
        console.log('🚪 SessionMonitor: Signing out due to cross-tab auth change')
        signOut()
      }
    },
    onCacheInvalidate: (payload) => {
      if (payload.keys?.includes('session_expired')) {
        console.log('🔄 SessionMonitor: Session expired in another tab, signing out')
        signOut()
      }
    },
    onSessionValidated: (payload) => {
      console.log('🔄 SessionMonitor: Session validated in another tab:', payload)
      // If this tab has the same user, ensure cart is loaded
      if (user?.id === payload.userId) {
        const now = Date.now()
        if (now - lastCrossTabCartReloadRef.current < 5000) {
          console.log('⏭️ SessionMonitor: Skipping duplicate cart reload (throttled)')
          return
        }
        lastCrossTabCartReloadRef.current = now
        console.log('🛒 SessionMonitor: Reloading cart due to cross-tab session validation')
        try {
          const maybePromise = forceLoadCartForUser(payload.userId)
          // Gracefully handle both Promise and non-Promise implementations
          if (maybePromise && typeof (maybePromise as any).catch === 'function') {
            (maybePromise as Promise<void>).catch(error => {
              console.warn('⚠️ SessionMonitor: Failed to reload cart from cross-tab validation:', error)
            })
          }
        } catch (error) {
          console.warn('⚠️ SessionMonitor: forceLoadCartForUser threw synchronously:', error)
        }
      }
    }
  })

  // Mark this tab as having the dedicated SessionMonitor mounted
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__FYP_SESSION_MONITOR_ACTIVE = true
      return () => { delete (window as any).__FYP_SESSION_MONITOR_ACTIVE }
    }
  }, [])

  // Enhanced session validation with retry logic and exponential backoff
  const validateSession = async (isRetry = false): Promise<boolean> => {
    if (isCheckingRef.current && !isRetry) return true

    isCheckingRef.current = true
    // CRITICAL: 5-second timeout to prevent hanging (fast recovery)
    const timeoutId = setTimeout(() => {
      console.error('❌ Session validation timeout - resetting lock')
      isCheckingRef.current = false
    }, 5000)  // 5 seconds is reasonable for session validation

    try {
      console.log('🔍 Session monitor: Validating session...', {
        isRetry,
        retryCount: retryCountRef.current,
        lastValidation: new Date(lastValidationTime).toISOString()
      })

      // 1) Fast client-side validation first
      const supabase = createClient()
      console.log('🔍 Session monitor: Supabase client:', supabase)
      
      // Test Supabase connection first
      try {
        console.log('🔍 Session monitor: Testing Supabase connection...')
        console.log('🔍 Session monitor: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log('🔍 Session monitor: Supabase Key (first 20 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...')
        
        // Test 1: Basic REST API connection
        const connectionTest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json'
          }
        })
        
        console.log('🔍 Session monitor: Supabase connection test result:', connectionTest.status)
        console.log('🔍 Session monitor: Response headers:', Object.fromEntries(connectionTest.headers.entries()))
        
        if (!connectionTest.ok) {
          console.warn('⚠️ Supabase connection test failed:', connectionTest.status, connectionTest.statusText)
          const errorText = await connectionTest.text().catch(() => 'Could not read error response')
          console.warn('⚠️ Supabase error response:', errorText)
        } else {
          console.log('✅ Supabase connection test successful')
        }

        // Test 2: Auth endpoint test
        try {
          console.log('🔍 Session monitor: Testing Supabase Auth endpoint...')
          const authTest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
            }
          })
          console.log('🔍 Session monitor: Auth endpoint status:', authTest.status)
        } catch (authError) {
          console.warn('⚠️ Auth endpoint test failed:', authError)
        }

        // Test 3: Database connection test
        try {
          console.log('🔍 Session monitor: Testing database connection...')
          const dbTest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Content-Type': 'application/json'
            }
          })
          console.log('🔍 Session monitor: Database test status:', dbTest.status)
          if (dbTest.ok) {
            const dbData = await dbTest.json()
            console.log('🔍 Session monitor: Database test data:', dbData)
          }
        } catch (dbError) {
          console.warn('⚠️ Database connection test failed:', dbError)
        }

        // Test 4: Environment variables check
        console.log('🔍 Session monitor: Environment check:', {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          urlValid: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co'),
          keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
          nodeEnv: process.env.NODE_ENV
        })

        // Test 5: Network timing test
        const startTime = Date.now()
        const timingTest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          }
        })
        const endTime = Date.now()
        console.log('🔍 Session monitor: Network timing:', {
          responseTime: `${endTime - startTime}ms`,
          status: timingTest.status
        })

      } catch (connectionError) {
        console.warn('⚠️ Supabase connection test error:', connectionError)
        console.warn('⚠️ Connection error details:', {
          name: (connectionError as Error).name,
          message: (connectionError as Error).message,
          stack: (connectionError as Error).stack
        })
      }
      
      try {
        // Add timeout to prevent hanging getSession() calls
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session validation timeout')), 5000)
        )
        
        const { data: sessionData } = await Promise.race([sessionPromise, timeoutPromise])
        console.log('🔍 Session monitor: Session data:', sessionData) 
        const sess = sessionData?.session
        console.log('🔍 Session monitor: Session:', sess)
        if (sess?.user) {
          const userId = sess.user.id
          console.log('🔍 Session monitor: User ID:', userId)
          const exp = (sess.expires_at ?? 0) * 1000
          const now = Date.now()
          console.log('🔍 Session monitor: Expiration time:', exp)
          const timeLeft = exp > 0 ? exp - now : Number.POSITIVE_INFINITY
          console.log('🔍 Session monitor: Time left:', timeLeft)
          // Only refresh tokens when they are close to expiry (<= 5 minutes)
          if (timeLeft <= 5 * 60 * 1000) {
            // Add timeout to prevent hanging refreshSession() calls
            const refreshPromise = supabase.auth.refreshSession()
            const refreshTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Token refresh timeout')), 5000)
            )
            
            const { data: refreshed, error: refreshErr } = await Promise.race([refreshPromise, refreshTimeoutPromise])
            console.log('🔍 Session monitor: Refreshed session:', refreshed)
            console.log('🔍 Session monitor: Refresh error:', refreshErr)
            if (refreshErr || !refreshed?.session?.user) {
              console.warn('⚠️ Token refresh near expiry failed, will try server validation')
            } else {
              console.log('✅ Client-side token refresh performed for user:', userId)
            }
          } else {
            console.log('✅ Client-side session valid without refresh; time left (min):', Math.round(timeLeft / 60000))
          }

          // Reset retry count on successful client validation
          retryCountRef.current = 0
          console.log('🔍 Session monitor: Resetting retry count')
          setLastValidationTime(Date.now())
          console.log('🔍 Session monitor: Last validation time:', new Date(lastValidationTime).toISOString())

          // Only reload cart if it's been more than 5 minutes since last cart load
          if (userId && user?.id === userId) {
            console.log('🔍 Session monitor: User ID matches, checking cart reload time')
            const timeSinceLastCartLoad = Date.now() - lastCrossTabCartReloadRef.current
            console.log('🔍 Session monitor: Time since last cart load:', timeSinceLastCartLoad)
            if (timeSinceLastCartLoad > 300000) { // 5 minutes
              console.log('🛒 Session monitor: Cart needs refresh after client validation')
              try {
                await forceLoadCartForUser(userId)
                console.log('🔍 Session monitor: Cart reloaded successfully')
                lastCrossTabCartReloadRef.current = Date.now()
                console.log('✅ Session monitor: Cart reloaded successfully after client validation')
              } catch (cartError) {
                console.warn('⚠️ Session monitor: Failed to reload cart after client validation:', cartError)
                console.error('❌ Session monitor: Failed to reload cart after client validation:', cartError)
              }
            } else {
              console.log('⏭️ Session monitor: Cart recently loaded, skipping reload')
            }
          }

          // Broadcast validation success and return early (no server call needed)
          broadcast('SESSION_VALIDATED', { userId, timestamp: Date.now() })
          clearTimeout(timeoutId)
          return true
        }
      } catch (e) {
        console.warn('⚠️ Client-side session check failed, falling back to server validation:', e)
      }

      // 2) Fallback to server validation only if client-side check is inconclusive
      // Defer the very first server validation slightly to avoid racing with auth initialization
      if (!isRetry && lastValidationTime === 0) {
        console.log('🔍 Session monitor: Deferring first server validation')
        clearTimeout(timeoutId)
        setTimeout(() => {
          console.log('🔍 Session monitor: Validating session with server fallback')
          // Mark as retry so we don't defer again
          validateSession(true)
        }, 1500)
        return true
      }

      // Use the correct validation endpoint
      const response = await fetch('/api/auth/session/validate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      console.log('🔍 Session monitor: Session validation response:', response)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.warn('❌ Session monitor: Session validation failed:', {
          status: response.status,
          error: errorData.error,
          retryCount: retryCountRef.current
        })

        // Broadcast session expiration to all tabs
        broadcast('CACHE_INVALIDATE', { keys: ['session_expired'] })

        // Sign out and clear all auth data
        await signOut()
        clearTimeout(timeoutId)
        return false
      }

      const data = await response.json()
      console.log('🔍 Session monitor: Session validation data:', data)
      console.log('✅ Session monitor: Session valid for user (server):', data.userId)

      // Reset retry count on successful validation
      retryCountRef.current = 0
      setLastValidationTime(Date.now())
      console.log('🔍 Session monitor: Resetting last validation time')
      // Only reload cart if it's been more than 5 minutes since last cart load
      if (data.userId && user?.id === data.userId) {
        const timeSinceLastCartLoad = Date.now() - lastCrossTabCartReloadRef.current
        if (timeSinceLastCartLoad > 300000) { // 5 minutes
          console.log('🛒 Session monitor: Cart needs refresh after server validation')
          try {
            await forceLoadCartForUser(data.userId)
            lastCrossTabCartReloadRef.current = Date.now()
            console.log('✅ Session monitor: Cart reloaded successfully after validation')
          } catch (cartError) {
            console.warn('⚠️ Session monitor: Failed to reload cart after validation:', cartError)
            // Don't fail session validation if cart loading fails
          }
        } else {
          console.log('⏭️ Session monitor: Cart recently loaded, skipping server validation reload')
        }
      }

      // Broadcast successful session validation to other tabs
      broadcast('SESSION_VALIDATED', { userId: data.userId, timestamp: Date.now() })

      clearTimeout(timeoutId)
      return true
    } catch (error: any) {
      console.error('❌ Session monitor: Validation request failed:', error)

      // Handle different types of errors
      if (error.name === 'AbortError') {
        console.warn('⏰ Session validation timed out')
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('🌐 Network error during session validation')
      }

      // Implement exponential backoff for retries
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000) // Max 30 seconds

        console.log(`🔄 Retrying session validation in ${backoffDelay}ms (attempt ${retryCountRef.current}/${maxRetries})`)

        clearTimeout(timeoutId)
        setTimeout(() => {
          validateSession(true)
        }, backoffDelay)
      } else {
        console.error('❌ Max retry attempts reached, treating as session expired')
        broadcast('CACHE_INVALIDATE', { keys: ['session_expired'] })
        await signOut()
        clearTimeout(timeoutId)
        return false
      }

      return true // Don't sign out on network errors during retry attempts
    } finally {
      clearTimeout(timeoutId)
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled || !user) return

    // Immediate initial validation with short delay to allow auth restoration to complete
    const initialTimeout = setTimeout(() => validateSession(), 1500)

    // Set up periodic validation checks (use the configured interval)
    intervalRef.current = setInterval(() => validateSession(), checkInterval)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, enabled, checkInterval])

  // Enhanced visibility change handling with cross-tab coordination and aggressive throttling
  useEffect(() => {
    if (!enabled || !user) return

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCheckingRef.current) {
        // Check if session was validated recently (increased to 5 minutes for performance)
        const timeSinceLastValidation = Date.now() - lastValidationTime
        if (timeSinceLastValidation < 300000) { // 5 minutes instead of 30 seconds
          console.log('⏭️ Session recently validated, skipping visibility check')
          return
        }

        console.log('🔍 Session monitor: Tab visible after long absence, validating session...')
        validateSession()
      }
    }

    const handleFocus = () => {
      // Only check on focus if it's been more than 5 minutes since last validation
      if (!isCheckingRef.current) {
        const timeSinceLastValidation = Date.now() - lastValidationTime
        if (timeSinceLastValidation < 300000) { // 5 minutes throttle
          console.log('⏭️ Session recently validated, skipping focus check')
          return
        }

        console.log('🔍 Session monitor: Window focused after long absence, validating session...')
        validateSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, enabled, lastValidationTime])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      isCheckingRef.current = false
      retryCountRef.current = 0
    }
  }, [])

  // This component doesn't render anything
  return null
}
