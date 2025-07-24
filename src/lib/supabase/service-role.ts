import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

/**
 * Creates a Supabase client with service role key that can bypass RLS policies
 * This should only be used on the server side for admin operations
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build time, environment variables might not be available
    console.warn('Supabase environment variables not available during build')
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      nodeEnv: process.env.NODE_ENV
    })
    return null as any
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

  console.log('🔧 Service role client created with URL:', supabaseUrl);
  console.log('🔑 Service role key length:', supabaseServiceKey?.length);

  return client;
}
