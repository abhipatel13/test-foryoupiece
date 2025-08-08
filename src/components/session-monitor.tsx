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
  const intervalRef = useRef<NodeJS.Timeout>()
  const isCheckingRef = useRef(false)
  const retryCountRef = useRef(0)
  const [lastValidationTime, setLastValidationTime] = useState<number>(0)

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
        console.log('🛒 SessionMonitor: Reloading cart due to cross-tab session validation')
        forceLoadCartForUser(payload.userId).catch(error => {
          console.warn('⚠️ SessionMonitor: Failed to reload cart from cross-tab validation:', error)
        })
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

    try {
      console.log('🔍 Session monitor: Validating session...', {
        isRetry,
        retryCount: retryCountRef.current,
        lastValidation: new Date(lastValidationTime).toISOString()
      })

      // 1) Fast client-side validation first
      const supabase = createClient()
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user) {
          // Try refreshing tokens to ensure validity
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
          if (!refreshErr && refreshed?.session?.user) {
            const userId = refreshed.session.user.id
            console.log('✅ Client-side session valid/refreshed for user:', userId)

            // Reset retry count on successful validation
            retryCountRef.current = 0
            setLastValidationTime(Date.now())

            // Ensure cart is loaded for the validated user
            if (userId && user?.id === userId) {
              console.log('🛒 Session monitor: Ensuring cart is loaded after client validation')
              try {
                await forceLoadCartForUser(userId)
                console.log('✅ Session monitor: Cart reloaded successfully after client validation')
              } catch (cartError) {
                console.warn('⚠️ Session monitor: Failed to reload cart after client validation:', cartError)
              }
            }

            // Broadcast validation success and return early (no server call needed)
            broadcast('SESSION_VALIDATED', { userId, timestamp: Date.now() })
            return true
          }
        }
      } catch (e) {
        console.warn('⚠️ Client-side session check failed, falling back to server validation:', e)
      }

      // 2) Fallback to server validation only if client-side check is inconclusive
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

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
        return false
      }

      const data = await response.json()
      console.log('✅ Session monitor: Session valid for user (server):', data.userId)

      // Reset retry count on successful validation
      retryCountRef.current = 0
      setLastValidationTime(Date.now())

      // Ensure cart is loaded for the validated user
      if (data.userId && user?.id === data.userId) {
        console.log('🛒 Session monitor: Ensuring cart is loaded after validation')
        try {
          await forceLoadCartForUser(data.userId)
          console.log('✅ Session monitor: Cart reloaded successfully after validation')
        } catch (cartError) {
          console.warn('⚠️ Session monitor: Failed to reload cart after validation:', cartError)
          // Don't fail session validation if cart loading fails
        }
      }

      // Broadcast successful session validation to other tabs
      broadcast('SESSION_VALIDATED', { userId: data.userId, timestamp: Date.now() })

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

        setTimeout(() => {
          validateSession(true)
        }, backoffDelay)
      } else {
        console.error('❌ Max retry attempts reached, treating as session expired')
        broadcast('CACHE_INVALIDATE', { keys: ['session_expired'] })
        await signOut()
        return false
      }

      return true // Don't sign out on network errors during retry attempts
    } finally {
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled || !user) return

    // Initial validation after a short delay
    const initialTimeout = setTimeout(() => validateSession(), 10000) // 10 seconds

    // Set up periodic validation checks
    intervalRef.current = setInterval(() => validateSession(), checkInterval)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, enabled, checkInterval])

  // Enhanced visibility change handling with cross-tab coordination
  useEffect(() => {
    if (!enabled || !user) return

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCheckingRef.current) {
        console.log('🔍 Session monitor: Tab visible, validating session...')

        // Check if session was validated recently (within last 30 seconds)
        const timeSinceLastValidation = Date.now() - lastValidationTime
        if (timeSinceLastValidation < 30000) {
          console.log('⏭️ Session recently validated, skipping check')
          return
        }

        // Validate session when tab becomes visible
        validateSession()
      }
    }

    const handleFocus = () => {
      // Also check when window gains focus (for multi-window scenarios)
      if (!isCheckingRef.current) {
        console.log('🔍 Session monitor: Window focused, validating session...')
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
