import { useState, useEffect } from 'react'

interface AdminConfig {
  adminEmail: string
  environment: string
}

interface UseAdminConfigReturn {
  adminEmail: string | null
  loading: boolean
  error: string | null
}

/**
 * Custom hook to fetch admin configuration from server-side API
 * 
 * This replaces the previous client-side environment variable access
 * for better security by keeping admin email server-side only
 */
export function useAdminConfig(): UseAdminConfigReturn {
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAdminConfig() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/admin/config')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch admin config: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch admin configuration')
        }

        setAdminEmail(result.data.adminEmail)
      } catch (err) {
        console.error('❌ Error fetching admin configuration:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAdminEmail(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAdminConfig()
  }, [])

  return {
    adminEmail,
    loading,
    error
  }
}

/**
 * Security Benefits:
 * - Admin email is fetched from server-side only
 * - No client-side environment variable exposure
 * - Proper error handling for missing configuration
 * - Loading states for better UX
 */
