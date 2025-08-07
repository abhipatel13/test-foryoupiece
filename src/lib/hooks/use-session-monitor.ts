import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  getCurrentSession,
  updateSessionActivity,
  shouldRefreshSession,
  refreshSessionTokens,
  checkSessionWarnings,
  clientSideLogout,
  createSession,
  type SessionWarning
} from '@/lib/security/session-manager'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'

/**
 * Enhanced session monitoring hook
 * Handles session timeouts, automatic refresh, and security warnings
 */
export function useSessionMonitor() {
  const router = useRouter()
  const { user, clearUser } = useSSRSafeUserStore()
  const [sessionWarning, setSessionWarning] = useState<SessionWarning | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Refs to prevent stale closures
  const userRef = useRef(user)
  const warningShownRef = useRef<string | null>(null)
  const refreshInProgressRef = useRef(false)
  
  // Update refs when user changes
  useEffect(() => {
    userRef.current = user
  }, [user])
  
  /**
   * Handle session expiration
   */
  const handleSessionExpiration = useCallback(async (reason: string) => {
    console.log('🔒 Session expired:', reason)
    
    if (userRef.current) {
      try {
        await clientSideLogout(userRef.current.id)

        // Also call server-side logout API for token blacklisting
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.warn('⚠️ Server-side logout API call failed:', error)
        }
      } catch (error) {
        console.error('❌ Error during logout:', error)
      }

      clearUser()
      toast.error('Your session has expired. Please log in again.')
      router.push('/en/auth/login?expired=true')
    }
  }, [clearUser, router])
  
  /**
   * Handle automatic token refresh
   */
  const handleTokenRefresh = useCallback(async (userId: string) => {
    if (refreshInProgressRef.current) {
      return false
    }
    
    refreshInProgressRef.current = true
    setIsRefreshing(true)
    
    try {
      console.log('🔄 Attempting automatic token refresh...')
      const result = await refreshSessionTokens(userId)
      
      if (result.success) {
        console.log('✅ Token refresh successful')
        return true
      } else {
        console.error('❌ Token refresh failed:', result.error)
        await handleSessionExpiration('refresh_failed')
        return false
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error)
      await handleSessionExpiration('refresh_error')
      return false
    } finally {
      refreshInProgressRef.current = false
      setIsRefreshing(false)
    }
  }, [handleSessionExpiration])
  
  /**
   * Show session warning to user
   */
  const showSessionWarning = useCallback((warning: SessionWarning) => {
    const warningKey = `${warning.type}_${Math.floor(warning.timeRemaining / 60000)}`
    
    // Prevent showing the same warning multiple times
    if (warningShownRef.current === warningKey) {
      return
    }
    
    warningShownRef.current = warningKey
    setSessionWarning(warning)
    
    // Show toast notification
    if (warning.type === 'idle_warning') {
      toast.warning(warning.message, {
        duration: 10000,
        action: {
          label: 'Stay Active',
          onClick: () => {
            if (userRef.current) {
              updateSessionActivity(userRef.current.id)
              setSessionWarning(null)
              warningShownRef.current = null
            }
          }
        }
      })
    } else {
      toast.warning(warning.message, {
        duration: 10000
      })
    }
  }, [])
  
  /**
   * Monitor session activity
   */
  const monitorSession = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) {
      return
    }
    
    // Get or create session
    let session = getCurrentSession(currentUser.id)
    if (!session) {
      session = createSession(currentUser.id)
    }
    
    // Update activity and check if session is still valid
    const isValid = updateSessionActivity(currentUser.id)
    if (!isValid) {
      await handleSessionExpiration('session_timeout')
      return
    }
    
    // Check if we need to refresh tokens
    if (shouldRefreshSession(currentUser.id)) {
      await handleTokenRefresh(currentUser.id)
    }
    
    // Check for session warnings
    const warning = checkSessionWarnings(currentUser.id)
    if (warning) {
      showSessionWarning(warning)
    } else {
      // Clear warning if no longer applicable
      setSessionWarning(null)
      warningShownRef.current = null
    }
  }, [handleSessionExpiration, handleTokenRefresh, showSessionWarning])
  
  /**
   * Handle user activity events
   */
  const handleUserActivity = useCallback(() => {
    if (userRef.current) {
      updateSessionActivity(userRef.current.id)
      // Clear warnings on activity
      setSessionWarning(null)
      warningShownRef.current = null
    }
  }, [])
  
  /**
   * Manual session extension
   */
  const extendSession = useCallback(() => {
    if (userRef.current) {
      updateSessionActivity(userRef.current.id)
      setSessionWarning(null)
      warningShownRef.current = null
      toast.success('Session extended')
    }
  }, [])
  
  /**
   * Manual logout
   */
  const logout = useCallback(async () => {
    if (userRef.current) {
      try {
        await clientSideLogout(userRef.current.id)

        // Also call server-side logout API for token blacklisting
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.warn('⚠️ Server-side logout API call failed:', error)
        }

        clearUser()
        toast.success('Successfully logged out')
        router.push('/en/auth/login')
      } catch (error) {
        console.error('❌ Logout error:', error)
        toast.error('Error during logout')
      }
    }
  }, [clearUser, router])
  
  // Set up session monitoring interval
  useEffect(() => {
    if (!user) {
      return
    }
    
    // Initial session creation
    createSession(user.id)
    
    // Monitor session every 30 seconds
    const interval = setInterval(monitorSession, 30 * 1000)
    
    return () => {
      clearInterval(interval)
    }
  }, [user, monitorSession])
  
  // Set up activity listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      return
    }
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    // Throttle activity updates to avoid excessive calls
    let lastActivity = 0
    const throttledActivity = () => {
      const now = Date.now()
      if (now - lastActivity > 60000) { // Update at most once per minute
        lastActivity = now
        handleUserActivity()
      }
    }
    
    events.forEach(event => {
      document.addEventListener(event, throttledActivity, true)
    })
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledActivity, true)
      })
    }
  }, [user, handleUserActivity])
  
  // Handle page visibility changes
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      return
    }
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, check session status
        monitorSession()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, monitorSession])
  
  return {
    sessionWarning,
    isRefreshing,
    extendSession,
    logout,
    monitorSession
  }
}
