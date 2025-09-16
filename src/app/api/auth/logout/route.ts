import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enhancedLogout } from '@/lib/security/session-manager'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'


import {
  handleAuthenticationError,
  handleGenericError
} from '@/lib/security/error-sanitizer'

/**
 * Enhanced logout endpoint with token blacklisting
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Enhanced logout: Request received')

    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('ℹ️ Enhanced logout: No authenticated user found — performing best-effort signOut and returning 200')
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('Logout signOut best-effort call failed (non-fatal)', e)
      }
      const res = NextResponse.json({ success: true, message: 'Logged out (no active session)' })
      // Ensure no caching and clear any auth-related intermediates
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
      res.headers.set('Pragma', 'no-cache')
      res.headers.set('Expires', '0')
      res.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return res
    }

    console.log('🔐 Enhanced logout: Processing logout for user:', user.id.substring(0, 8) + '...')

    // Perform enhanced logout with token blacklisting
    const logoutResult = await enhancedLogout(user.id)

    if (!logoutResult.success) {
      console.error('❌ Enhanced logout failed:', logoutResult.error)
      // Still return 200 for client resilience but include detail
      const res = NextResponse.json({ success: true, message: 'Logout completed with warnings' })
      res.headers.set('X-Logout-Error', (logoutResult.error || 'unknown').toString())
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
      res.headers.set('Pragma', 'no-cache')
      res.headers.set('Expires', '0')
      res.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return res
    }

    console.log('✅ Enhanced logout: Successfully completed for user:', user.id.substring(0, 8) + '...')

    const res = NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    res.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
    return res

  } catch (error) {
    return handleGenericError(error, {
      operation: 'enhanced_logout',
      endpoint: '/api/auth/logout'
    })
  }
}

/**
 * Get logout status (for debugging)
 * GET /api/auth/logout
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    return NextResponse.json({
      success: true,
      authenticated: !!user && !userError,
      user: user ? {
        id: user.id.substring(0, 8) + '...',
        email: user.email
      } : null
    })

  } catch (error) {
    return handleGenericError(error, {
      operation: 'logout_status',
      endpoint: '/api/auth/logout'
    })
  }
}
