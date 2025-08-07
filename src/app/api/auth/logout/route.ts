import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enhancedLogout } from '@/lib/security/session-manager'
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
      console.log('❌ Enhanced logout: No authenticated user found')
      return handleAuthenticationError(
        new Error('No authenticated user'),
        { operation: 'logout', endpoint: '/api/auth/logout' }
      )
    }

    console.log('🔐 Enhanced logout: Processing logout for user:', user.id.substring(0, 8) + '...')

    // Perform enhanced logout with token blacklisting
    const logoutResult = await enhancedLogout(user.id)

    if (!logoutResult.success) {
      console.error('❌ Enhanced logout failed:', logoutResult.error)
      return handleAuthenticationError(
        new Error(logoutResult.error || 'Logout failed'),
        { 
          operation: 'enhanced_logout',
          userId: user.id,
          endpoint: '/api/auth/logout'
        }
      )
    }

    console.log('✅ Enhanced logout: Successfully completed for user:', user.id.substring(0, 8) + '...')

    return NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    })

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
