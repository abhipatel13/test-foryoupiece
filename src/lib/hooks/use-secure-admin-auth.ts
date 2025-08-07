'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clearAdminTokensFromStorage, isAdminMigrationCompleted } from '@/lib/utils/admin-token-migration'

interface AdminUser {
  id: string
  email: string
  role: string
}

interface AdminSession {
  expiresAt: number
  createdAt: number
  lastRotated?: number
  rotated?: boolean
}

interface AdminAuthState {
  user: AdminUser | null
  session: AdminSession | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

/**
 * Secure admin authentication hook using httpOnly cookies
 * Replaces localStorage-based token storage with secure server-side sessions
 */
export function useSecureAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    loading: true,
    error: null
  })

  const router = useRouter()
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const isInitialized = useRef(false)

  /**
   * Validate current session with the server
   */
  const validateSession = useCallback(async (showErrors = false): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/session', {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.success) {
          setAuthState(prev => ({
            ...prev,
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            loading: false,
            error: null
          }))

          // Log session rotation for security monitoring
          if (data.session.rotated) {
            console.log('🔄 Admin session token rotated for enhanced security')
          }

          return true
        }
      }

      // Session invalid or expired
      setAuthState(prev => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: showErrors ? 'Session expired or invalid' : null
      }))

      return false
    } catch (error) {
      console.error('❌ Session validation error:', error)
      setAuthState(prev => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: showErrors ? 'Failed to validate session' : null
      }))
      return false
    }
  }, [])

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAuthState(prev => ({
          ...prev,
          user: data.user,
          session: data.session,
          isAuthenticated: true,
          loading: false,
          error: null
        }))

        console.log('✅ Admin login successful:', data.user.email, 'role:', data.user.role)
        toast.success('Admin login successful!')
        return true
      } else {
        const errorMessage = data.error || 'Login failed'
        setAuthState(prev => ({
          ...prev,
          user: null,
          session: null,
          isAuthenticated: false,
          loading: false,
          error: errorMessage
        }))
        toast.error(errorMessage)
        return false
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      const errorMessage = 'Network error during login'
      setAuthState(prev => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: errorMessage
      }))
      toast.error(errorMessage)
      return false
    }
  }, [])

  /**
   * Logout and clear session
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear session interval
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current)
        sessionCheckInterval.current = null
      }

      // Call logout endpoint
      await fetch('/api/admin/session', {
        method: 'DELETE',
        credentials: 'include'
      })

      // Clear local state
      setAuthState({
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: null
      })

      console.log('🚪 Admin logout successful')
      toast.success('Logged out successfully')

      // Redirect to login page
      router.push('/en/admin')
    } catch (error) {
      console.error('❌ Logout error:', error)
      // Still clear local state even if server request fails
      setAuthState({
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
        error: null
      })
      router.push('/en/admin')
    }
  }, [router])

  /**
   * Get authorization header for API requests
   * Returns session validation instead of token
   */
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    // Validate session before making API calls
    const isValid = await validateSession()
    
    if (!isValid) {
      throw new Error('Admin session expired. Please login again.')
    }

    // Return empty headers since authentication is handled by httpOnly cookies
    return {
      'Cache-Control': 'no-cache'
    }
  }, [validateSession])

  /**
   * Setup periodic session validation
   */
  const setupSessionMonitoring = useCallback(() => {
    // Clear existing interval
    if (sessionCheckInterval.current) {
      clearInterval(sessionCheckInterval.current)
    }

    // Check session every 5 minutes
    sessionCheckInterval.current = setInterval(async () => {
      const isValid = await validateSession()
      if (!isValid && authState.isAuthenticated) {
        console.log('🕐 Admin session expired during monitoring')
        toast.warning('Your admin session has expired. Please login again.')
        router.push('/en/admin')
      }
    }, 5 * 60 * 1000) // 5 minutes

    console.log('🔄 Admin session monitoring started')
  }, [validateSession, authState.isAuthenticated, router])

  /**
   * Initialize authentication state
   */
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const initializeAuth = async () => {
      console.log('🔐 Initializing secure admin authentication...')

      // Run admin token migration if needed
      if (!isAdminMigrationCompleted()) {
        console.log('🔄 Running admin token migration...')
        const migrationResult = clearAdminTokensFromStorage()
        if (migrationResult.success && migrationResult.clearedItems.length > 0) {
          toast.info('Admin authentication system updated for enhanced security')
        }
      }

      await validateSession()
    }

    initializeAuth()
  }, [validateSession])

  /**
   * Setup session monitoring when authenticated
   */
  useEffect(() => {
    if (authState.isAuthenticated) {
      setupSessionMonitoring()
    } else {
      // Clear monitoring when not authenticated
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current)
        sessionCheckInterval.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current)
      }
    }
  }, [authState.isAuthenticated, setupSessionMonitoring])

  /**
   * Handle session expiration warnings
   */
  useEffect(() => {
    if (authState.session?.expiresAt) {
      const timeUntilExpiry = authState.session.expiresAt - Date.now()
      const warningTime = 30 * 60 * 1000 // 30 minutes before expiry

      if (timeUntilExpiry > 0 && timeUntilExpiry <= warningTime) {
        const timeout = setTimeout(() => {
          toast.warning('Your admin session will expire soon. Please save your work.')
        }, Math.max(0, timeUntilExpiry - warningTime))

        return () => clearTimeout(timeout)
      }
    }
  }, [authState.session?.expiresAt])

  return {
    ...authState,
    login,
    logout,
    validateSession,
    getAuthHeaders,
    // Computed properties
    isAdmin: authState.isAuthenticated,
    sessionExpiresAt: authState.session?.expiresAt,
    sessionCreatedAt: authState.session?.createdAt,
    // Helper methods
    refreshSession: () => validateSession(true)
  }
}
