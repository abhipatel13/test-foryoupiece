import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

/**
 * Creates a Supabase client with service role key that can bypass RLS policies
 * This should only be used on the server side for admin operations
 */
export function createServiceRoleClient() {
  // Check if we're on the client side
  if (typeof window !== 'undefined') {
    console.warn('Service role client should not be used on client side')
    return null as any
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build time or local development, environment variables might not be available.
    // In production, this is a critical misconfiguration and we must fail fast to avoid silent no-ops.
    const isProd = process.env.NODE_ENV === 'production'

    if (isProd) {
      throw new Error('SUPABASE service role configuration missing in production (check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)')
    }

    console.warn('⚠️ Using mock Supabase service role client (non-production only). Missing env:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      nodeEnv: process.env.NODE_ENV
    })

    // Return a mock client for build time/dev to prevent crashes, but DO NOT use in production
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
      }),
      rpc: (functionName: string, params?: any) => {
        console.warn(`🚨 Mock service role client: RPC call to ${functionName} with params:`, params)
        return Promise.resolve({ data: null, error: { message: 'Mock client - RPC not available (dev/build only)' } })
      },
    } as any
  }

  const client = createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      }
    }
  )

  // SECURITY FIX: Remove debug logs that could expose service role configuration
  return client;
}
