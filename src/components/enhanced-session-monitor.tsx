'use client'

import { useEffect, useRef, useState } from 'react'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'
import { createClient } from '@/lib/supabase/client'
import { checkSessionWarnings, updateSessionActivity } from '@/lib/security/session-manager'

interface SessionStatus {
  valid: boolean
  sessionAge?: string
  remainingTime?: string
  warning?: {
    type: 'idle_warning' | 'absolute_warning'
    message: string
    timeRemaining: number
  }
}

/**
 * Enhanced Session Monitor Component
 * Provides comprehensive session monitoring with security features
 */
export function EnhancedSessionMonitor() {
  const { user, clearUser } = useSSRSafeUserStore()
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({ valid: false })
  const [showWarning, setShowWarning] = useState(false)
  const validationIntervalRef = useRef<NodeJS.Timeout>()
  const warningCheckIntervalRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  // Global OAuth code-exchange fallback (handles stray ?code= from OAuth providers)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      const hasCode = url.searchParams.get('code')
      const processed = sessionStorage.getItem('__oauth_code_exchanged') === '1'
      if (!hasCode || processed) return

      const supabase = createClient()
      ;(async () => {
        try {
          // Exchange the code for a session on the client (works when landing on unexpected routes like "/")
          const { data, error } = await (supabase.auth as any).exchangeCodeForSession(window.location.href)
          if (error) {
            console.warn('⚠️ OAuth code exchange failed (fallback):', error?.message || error)
            return
          }
          sessionStorage.setItem('__oauth_code_exchanged', '1')
          // Ensure profile row exists ASAP
          fetch('/api/auth/ensure-profile', { method: 'POST', headers: { 'cache-control': 'no-store' } }).catch(() => {})

          // Clean URL and force a one-time hard reload with cache-buster to hydrate fresh data
          try {
            url.searchParams.delete('code')
            url.searchParams.delete('state')
            url.searchParams.set('r', String(Date.now()))
            window.location.replace(url.toString())
          } catch {}
        } catch (e) {
          console.warn('⚠️ OAuth code exchange error (fallback):', e)
        }
      })()
    } catch (e) {
      console.warn('⚠️ OAuth fallback guard error:', e)
    }
  }, [])

  // Multi-tab synchronization
  const { broadcast } = useMultiTabSync({
    onSessionExpired: (payload) => {
      console.log('🔒 Session expired in another tab:', payload)
      handleSessionExpired('cross_tab_expiration')
    },
    onSessionValidated: (payload) => {
      console.log('✅ Session validated in another tab:', payload)
      setSessionStatus({ valid: true, ...payload })
      setShowWarning(false)
    },
    onSessionWarning: (payload) => {
      console.log('⚠️ Session warning from another tab:', payload)
      setSessionStatus(prev => ({ ...prev, warning: payload }))
      setShowWarning(true)
    },
    onSecurityEvent: (payload) => {
      console.log('🚨 Security event from another tab:', payload)
      if (payload.action === 'force_logout') {
        handleSessionExpired('security_event')
      }
    }
  })

  // Enhanced session validation
  const validateSession = async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const response = await fetch('/api/auth/session/enhanced-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (result.valid) {
        setSessionStatus({
          valid: true,
          sessionAge: result.session?.age ? Math.round(result.session.age / (60 * 1000)) + 'min' : undefined,
          remainingTime: result.session?.remainingTime ? Math.round(result.session.remainingTime / (60 * 1000)) + 'min' : undefined
        })

        // Update activity tracking
        updateSessionActivity(user.id)

        // Broadcast validation to other tabs
        broadcast('SESSION_VALIDATED', {
          sessionAge: result.session?.age ? Math.round(result.session.age / (60 * 1000)) + 'min' : undefined,
          remainingTime: result.session?.remainingTime ? Math.round(result.session.remainingTime / (60 * 1000)) + 'min' : undefined
        }, 'normal')

        return true
      } else {
        console.warn('❌ Session validation failed:', result.reason)
        setSessionStatus({ valid: false })

        // Handle different failure reasons
        if (result.reason === 'session_expired' || result.reason === 'token_blacklisted') {
          handleSessionExpired(result.reason)
        }

        return false
      }
    } catch (error) {
      console.error('❌ Session validation error:', error)
      setSessionStatus({ valid: false })
      return false
    }
  }

  // Check for session warnings
  const checkForWarnings = () => {
    if (!user?.id) return

    const warning = checkSessionWarnings(user.id)
    if (warning) {
      setSessionStatus(prev => ({ ...prev, warning }))
      setShowWarning(true)

      // Broadcast warning to other tabs
      broadcast('SESSION_WARNING', warning, 'high')

      console.log('⚠️ Session warning:', warning.message)
    } else {
      setSessionStatus(prev => ({ ...prev, warning: undefined }))
      setShowWarning(false)
    }
  }

  // Handle session expiration
  const handleSessionExpired = async (reason: string) => {
    console.log('🔒 Handling session expiration:', reason)

    // Clear user state
    clearUser()
    setSessionStatus({ valid: false })
    setShowWarning(false)

    // Broadcast expiration to other tabs
    broadcast('SESSION_EXPIRED', { reason }, 'critical')

    // Sign out from Supabase
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('❌ Error signing out:', error)
    }

    // Redirect to login if on a protected page
    if (typeof window !== 'undefined') {
      const protectedPaths = ['/account', '/profile', '/checkout', '/orders']
      const currentPath = window.location.pathname

      if (protectedPaths.some(path => currentPath.includes(path))) {
        window.location.href = `/en/auth/login?redirectTo=${encodeURIComponent(currentPath)}&reason=${reason}`
      }
    }
  }

  // Track user activity
  const trackActivity = () => {
    lastActivityRef.current = Date.now()
    if (user?.id) {
      updateSessionActivity(user.id)
    }
  }

  // Setup activity tracking
  useEffect(() => {
    if (typeof window === 'undefined') return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity)
      })
    }
  }, [user?.id])

  // Setup session monitoring
  useEffect(() => {
    if (!user?.id) {
      // Clear intervals if no user
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current)
      }
      if (warningCheckIntervalRef.current) {
        clearInterval(warningCheckIntervalRef.current)
      }
      return
    }

    // Initial validation
    validateSession()

    // Setup periodic validation (every 5 minutes)
    validationIntervalRef.current = setInterval(validateSession, 5 * 60 * 1000)

    // Setup warning checks (every minute)
    warningCheckIntervalRef.current = setInterval(checkForWarnings, 60 * 1000)

    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current)
      }
      if (warningCheckIntervalRef.current) {
        clearInterval(warningCheckIntervalRef.current)
      }
    }
  }, [user?.id])

  // Session warning UI
  if (showWarning && sessionStatus.warning) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Session Warning</h3>
            <p className="mt-1 text-sm text-yellow-700">{sessionStatus.warning.message}</p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={() => validateSession()}
                className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded"
              >
                Extend Session
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="text-xs text-yellow-600 hover:text-yellow-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No visible UI when everything is normal
  return null
}
