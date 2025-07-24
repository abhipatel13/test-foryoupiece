import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

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

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
