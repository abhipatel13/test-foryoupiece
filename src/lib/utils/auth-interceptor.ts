'use client'

import { createClient } from '@/lib/supabase/client'
import { tabSyncUtils } from '@/lib/utils/multi-tab-sync'

/**
 * Enhanced Authentication Interceptor
 * Handles session expiration, refresh, and automatic sign-out on auth errors
 */

// Global state for auth error handling
let isHandlingAuthError = false
let authErrorCount = 0
const MAX_AUTH_ERRORS = 3
const AUTH_ERROR_RESET_TIME = 10000 // 10 seconds


// Telemetry counters for observability
const TELEMETRY = {
  refreshAttempts: 0,
  refreshSuccesses: 0,
  refreshFailures: 0,
  getUserAttempts: 0,
  getUserSuccesses: 0,
  getUserFailures: 0,
  cleanupEscalations: 0,
}

// Conservative retry/backoff settings
const AUTH_RETRY_ATTEMPTS = 2
const AUTH_RETRY_BASE_DELAY_MS = 500

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let authHandler: (() => Promise<void>) | null = null

/**
 * Register auth error handler
 */
export function registerAuthHandler(handler: () => Promise<void>) {
  authHandler = handler
  console.log('🔐 Auth handler registered')
}

/**
 * Unregister auth error handler
 */
export function unregisterAuthHandler() {
  authHandler = null
  console.log('🔐 Auth handler unregistered')
}

/**
 * Check if error is an authentication error
 */
function isAuthError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || ''
  const errorCode = error.code?.toLowerCase() || ''

  return (
    error.status === 401 ||
    error.status === 403 ||
    errorMessage.includes('jwt') ||
    errorMessage.includes('token') ||
    errorMessage.includes('session') ||
    errorMessage.includes('refresh') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('invalid claim') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorCode === 'pgrst301' ||
    errorCode === 'invalid_jwt'
  )
}

/**
 * Enhanced authentication error handler with session refresh
 */
export async function handleAuthError(error: any, url?: string) {
  // Check if it's actually an auth error
  if (!isAuthError(error)) return

  // Prevent infinite loops
  if (isHandlingAuthError || authErrorCount >= MAX_AUTH_ERRORS) {
    console.log('🔄 Auth error handling skipped', {
      isHandling: isHandlingAuthError,
      errorCount: authErrorCount
    })
    return
  }

  console.log('🚨 Handling auth error', { url, error: error.message })

  isHandlingAuthError = true
  authErrorCount++

  try {
    const supabase = createClient()

    // Conservative retry/backoff loop before any cleanup escalation
    let recovered = false
    for (let attempt = 0; attempt <= AUTH_RETRY_ATTEMPTS; attempt++) {
      const delay = attempt === 0 ? 0 : AUTH_RETRY_BASE_DELAY_MS * attempt
      if (delay > 0) await sleep(delay)

      // 1) Try refreshSession
      try {
        TELEMETRY.refreshAttempts++
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && session) {
          TELEMETRY.refreshSuccesses++
          console.log('✅ Session refreshed successfully (attempt %d)', attempt + 1)
          authErrorCount = 0
          recovered = true
          break
        } else {
          TELEMETRY.refreshFailures++
          console.warn('🔁 refreshSession failed (attempt %d): %s', attempt + 1, refreshError?.message)
        }
      } catch (e) {
        TELEMETRY.refreshFailures++
        console.warn('🔁 refreshSession threw (attempt %d):', attempt + 1, e)
      }

      // 2) Validate with getUser
      try {
        TELEMETRY.getUserAttempts++
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (user && !userError) {
          TELEMETRY.getUserSuccesses++
          console.log('🆗 getUser succeeded after refresh failure (attempt %d) - preserving tokens for auto-refresh', attempt + 1)
          // Optionally kick refresh again in background but do not block UX
          try { await supabase.auth.refreshSession() } catch {}
          authErrorCount = 0
          recovered = true
          break
        } else {
          TELEMETRY.getUserFailures++
          console.warn('🧪 getUser failed (attempt %d): %s', attempt + 1, userError?.message)
        }
      } catch (e) {
        TELEMETRY.getUserFailures++
        console.warn('🧪 getUser threw (attempt %d):', attempt + 1, e)
      }
    }

    if (recovered) return

    // Escalation: confirmed failures after retries -> broadcast + cleanup
    console.log('❌ Confirmed auth failure after retries; escalating to cleanup')

    try {
      tabSyncUtils.broadcastSessionExpired('Confirmed auth failure after retries in auth interceptor')
    } catch (broadcastError) {
      console.error('Failed to broadcast session expiration:', broadcastError)
    }

    if (authHandler) {
      await authHandler()
      return
    }

    // Fallback cleanup path
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      console.error('Sign out error:', signOutError)
    }

    // Clear fixed auth-related localStorage items first
    const authKeys = [
      'supabase.auth.token',
      'foryoupiece-user',
      'foryoupiece-cart',
      'session_validated_at'
    ]

    // Include Supabase v2 sb-<ref>-auth-token only at escalation time
    try {
      const dynamicKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (key.startsWith('sb-') && key.includes('auth')) {
          dynamicKeys.push(key)
        }
      }
      if (dynamicKeys.length > 0) {
        TELEMETRY.cleanupEscalations++
        console.warn('🧹 Cleanup escalation: removing sb-* auth keys', { count: dynamicKeys.length })
        authKeys.push(...dynamicKeys)
      }
    } catch (e) {
      console.warn('Failed to enumerate localStorage keys for cleanup:', e)
    }

    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.error(`Failed to remove ${key}:`, e)
      }
    })

    // Clear sessionStorage
    try {
      sessionStorage.clear()
    } catch (e) {
      console.error('Failed to clear session storage:', e)
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/en/auth/login?expired=true'
    }
  } catch (handlingError) {
    console.error('Error handling auth error:', handlingError)
    // Force redirect on any error
    if (typeof window !== 'undefined') {
      window.location.href = '/en/auth/login'
    }
  } finally {
    isHandlingAuthError = false

    // Reset error count after timeout
    setTimeout(() => {
      authErrorCount = 0
      // Emit telemetry snapshot for diagnostics (dev only)
      try {
        if (process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
          console.log('📊 Auth telemetry snapshot', { ...TELEMETRY })
        }
      } catch {}
    }, AUTH_ERROR_RESET_TIME)
  }
}

/**
 * Enhanced fetch wrapper that handles authentication errors
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const response = await fetch(url, options)

    // Handle 401 errors immediately
    if (response.status === 401) {
      console.warn(`🚨 Auth Interceptor: 401 detected for ${url}`)
      await handleAuthError({ status: 401, message: 'Unauthorized' }, url)

      // Don't throw here, let the calling code handle the response
      // This allows for graceful degradation
    }

    // Handle 403 errors (forbidden - might indicate expired session)
    if (response.status === 403) {
      console.warn(`🚨 Auth Interceptor: 403 detected for ${url}`)
      await handleAuthError({ status: 403, message: 'Forbidden' }, url)
    }

    return response
  } catch (error) {
    // Handle network errors that might indicate auth issues (silent to keep console clean)
    if (error instanceof TypeError && (error as any).message?.includes('Failed to fetch')) {
      // This could be a CORS issue due to expired session
      await handleAuthError(error, url)
    }
    // Re-throw so callers can gracefully handle and show UI fallbacks without logging to console
    throw error
  }
}

/**
 * Wrapper for API calls that automatically handles auth errors
 */
export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const response = await authFetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        error: data.error || `HTTP ${response.status}`,
        status: response.status
      }
    }

    return {
      data,
      status: response.status
    }
  } catch (error) {
    console.error('API call error:', error)
    return {
      error: error instanceof Error ? error.message : 'Network error',
      status: 0
    }
  }
}

/**
 * Hook to setup authentication error handling
 */
export function useAuthInterceptor(handleSessionExpiration: () => Promise<void>) {
  // Register the handler on mount
  React.useEffect(() => {
    registerAuthHandler(handleSessionExpiration)

    return () => {
      unregisterAuthHandler()
    }
  }, [handleSessionExpiration])
}

// For React import
import React from 'react'
