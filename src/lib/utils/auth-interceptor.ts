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
    // Try to refresh the session first
    const supabase = createClient()
    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()

    if (!refreshError && session) {
      console.log('✅ Session refreshed successfully')
      authErrorCount = 0
      return
    }

    // If refresh failed, validate with server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('❌ Session validation failed, signing out')

      // Broadcast session expiration to all tabs
      try {
        tabSyncUtils.broadcastSessionExpired('Session validation failed in auth interceptor')
      } catch (broadcastError) {
        console.error('Failed to broadcast session expiration:', broadcastError)
      }

      // Clear all auth data
      if (authHandler) {
        await authHandler()
      } else {
        // Enhanced fallback cleanup
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.error('Sign out error:', signOutError)
        }

        // Clear all auth-related localStorage items
        const authKeys = [
          'supabase.auth.token',
          'foryoupiece-user',
          'foryoupiece-cart',
          'session_validated_at'
        ]

        try {
          // Also include any Supabase v2 auth keys (sb-<ref>-auth-token...)
          const dynamicKeys: string[] = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key) continue
            if (key.startsWith('sb-') && key.includes('auth')) {
              dynamicKeys.push(key)
            }
          }
          authKeys.push(...dynamicKeys)
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
      }
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
