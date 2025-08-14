import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCurrentSession,
  updateSessionActivity,
  checkSessionWarnings,
  isTokenBlacklisted,
  createSession,
} from '@/lib/security/session-manager'
import {
  handleAuthenticationError,
  handleGenericError
} from '@/lib/security/error-sanitizer'

/**
 * Session validation endpoint
 * POST /api/auth/session/validate
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Session validation: Request received')

    // Get the authenticated user
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session || !session.user) {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('❌ Session validation: No valid session found')
      }
      return NextResponse.json({
        success: false,
        valid: false,
        reason: 'no_session'
      }, { status: 401 })
    }

    const user = session.user

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(session.access_token)
    if (isBlacklisted) {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('❌ Session validation: Token is blacklisted for user:', user.id.substring(0, 8) + '...')
      }
      return NextResponse.json({
        success: false,
        valid: false,
        reason: 'token_blacklisted'
      }, { status: 401 })
    }

    // Get or create current session state on the server
    let sessionState = getCurrentSession(user.id)
    if (!sessionState) {
      // Create a fresh server-side session state to avoid false negatives
      sessionState = createSession(user.id)
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('🆕 Created server session state for user:', user.id.substring(0, 8) + '...')
      }
    }

    // Update session activity and check validity
    const isValid = updateSessionActivity(user.id)
    if (!isValid) {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('❌ Session validation: Session expired for user:', user.id.substring(0, 8) + '...')
      }
      return NextResponse.json({
        success: false,
        valid: false,
        reason: 'session_expired'
      }, { status: 401 })
    }

    // Check for session warnings
    const warning = checkSessionWarnings(user.id)

    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
      console.log('✅ Session validation: Valid session for user:', user.id.substring(0, 8) + '...')
    }

    return NextResponse.json({
      success: true,
      valid: true,
      session: {
        userId: user.id,
        sessionId: sessionState.sessionId,
        lastActivity: sessionState.lastActivity,
        expiresAt: sessionState.expiresAt
      },
      warning: warning ? {
        type: warning.type,
        timeRemaining: warning.timeRemaining,
        message: warning.message
      } : null
    })

  } catch (error) {
    return handleGenericError(error, {
      operation: 'session_validation',
      endpoint: '/api/auth/session/validate'
    })
  }
}

/**
 * Session refresh endpoint
 * PUT /api/auth/session/validate
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 Session refresh: Request received')

    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('❌ Session refresh: No authenticated user found')
      return handleAuthenticationError(
        new Error('No authenticated user'),
        { operation: 'session_refresh', endpoint: '/api/auth/session/validate' }
      )
    }

    // Refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

    if (refreshError || !refreshData.session) {
      console.error('❌ Session refresh failed:', refreshError?.message)
      return NextResponse.json({
        success: false,
        error: 'Session refresh failed'
      }, { status: 401 })
    }

    // Update session activity
    updateSessionActivity(user.id)

    console.log('✅ Session refresh: Successfully refreshed for user:', user.id.substring(0, 8) + '...')

    return NextResponse.json({
      success: true,
      message: 'Session refreshed successfully',
      session: {
        access_token: refreshData.session.access_token,
        refresh_token: refreshData.session.refresh_token,
        expires_at: refreshData.session.expires_at
      }
    })

  } catch (error) {
    return handleGenericError(error, {
      operation: 'session_refresh',
      endpoint: '/api/auth/session/validate'
    })
  }
}
