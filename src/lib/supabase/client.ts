import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Custom storage implementation with validation
class ValidatedStorage {
  private prefix = 'supabase.auth.'

  getItem(key: string): string | null {
    try {
      const value = localStorage.getItem(key)

      // Validate stored session data
      if (key.startsWith(this.prefix) && value) {
        try {
          const data = JSON.parse(value)
          // Check if session has required fields
          if (data.access_token && data.refresh_token) {
            return value
          }
          // Invalid session data - remove it
          console.warn('🧹 Removing invalid session data from storage')
          localStorage.removeItem(key)
          return null
        } catch {
          // Invalid JSON - remove it
          console.warn('🧹 Removing corrupted session data from storage')
          localStorage.removeItem(key)
          return null
        }
      }

      return value
    } catch (error) {
      console.error('Storage getItem error:', error)
      return null
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.error('Storage setItem error:', error)
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Storage removeItem error:', error)
    }
  }
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, environment variables might not be available
    if (typeof window === 'undefined') {
      console.warn('Supabase environment variables not available during build')
      return null as any
    }

    // In production, this should never happen if env vars are properly configured
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      nodeEnv: process.env.NODE_ENV
    })
    throw new Error('Missing Supabase environment variables. Please check your environment configuration.')
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        storage: new ValidatedStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    }
  )
}
