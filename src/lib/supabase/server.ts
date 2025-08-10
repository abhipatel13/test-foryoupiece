import { createServerClient } from '@supabase/ssr'
import { Database } from './database.types'

// Check if we're in an App Router context where next/headers is available
function isAppRouterContext(): boolean {
  try {
    // Try to access next/headers - this will throw in Pages Router context
    require('next/headers')
    return true
  } catch {
    return false
  }
}

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, environment variables might not be available
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase environment variables not available during build')
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
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
    } as any
  }

  // For App Router context, use next/headers
  if (isAppRouterContext()) {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    return createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
  }

  // For Pages Router context or when next/headers is not available,
  // fall back to client-side Supabase client
  const { createClient: createBrowserClient } = await import('./client')
  return createBrowserClient()
}
