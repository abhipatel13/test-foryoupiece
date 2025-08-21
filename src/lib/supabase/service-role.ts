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
    // During build time, environment variables might not be available
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase environment variables not available during build')
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        nodeEnv: process.env.NODE_ENV
      })
    }

    // Return a mock client for build time
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
        console.warn(`🚨 Mock service role client: RPC call to ${functionName} with params:`, params);
        return Promise.resolve({ data: null, error: { message: 'Mock client - RPC not available during build' } });
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
