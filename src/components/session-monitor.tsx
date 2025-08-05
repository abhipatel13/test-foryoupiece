'use client'

import { useEffect, useRef } from 'react'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'

interface SessionMonitorProps {
  checkInterval?: number // in milliseconds
  enabled?: boolean
}

/**
 * Session Monitor Component
 * Continuously monitors session health and automatically signs out on invalid sessions
 */
export function SessionMonitor({ 
  checkInterval = 5 * 60 * 1000, // 5 minutes default
  enabled = true 
}: SessionMonitorProps) {
  const { user, signOut } = useSSRSafeAuth()
  const intervalRef = useRef<NodeJS.Timeout>()
  const isCheckingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !user) return

    const checkSession = async () => {
      // Prevent concurrent checks
      if (isCheckingRef.current) return
      
      isCheckingRef.current = true
      
      try {
        console.log('🔍 Session monitor: Checking session health...')
        
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          console.warn('❌ Session monitor: Session invalid, signing out...')
          await signOut()
        } else {
          const data = await response.json()
          console.log('✅ Session monitor: Session valid for user:', data.userId)
        }
      } catch (error) {
        console.error('❌ Session monitor: Check failed:', error)
        // Don't sign out on network errors, only on auth errors
      } finally {
        isCheckingRef.current = false
      }
    }

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkSession, 10000) // 10 seconds

    // Set up periodic checks
    intervalRef.current = setInterval(checkSession, checkInterval)
    
    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, signOut, checkInterval, enabled])

  // Handle visibility change - check when tab becomes visible
  useEffect(() => {
    if (!enabled || !user) return

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCheckingRef.current) {
        console.log('🔍 Session monitor: Tab visible, checking session...')
        // Check session when tab becomes visible
        fetch('/api/auth/validate', {
          method: 'POST',
          credentials: 'include',
        }).then(response => {
          if (!response.ok) {
            signOut()
          }
        }).catch(error => {
          console.error('Session check on visibility change failed:', error)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, signOut, enabled])

  // This component doesn't render anything
  return null
}
