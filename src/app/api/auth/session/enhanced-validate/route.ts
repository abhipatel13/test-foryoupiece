import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTokenBlacklisted } from '@/lib/security/session-manager'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'


/**
 * Enhanced Session Validation API
 * Provides comprehensive session validation with security checks
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({
        valid: false,
        reason: 'no_session',
        error: sessionError?.message || 'No active session'
      }, { status: 401 })
    }

    // Enhanced session validation checks
    const validationResults = {
      sessionExists: !!session,
      userExists: !!session.user,
      tokenValid: false,
      sessionAge: 0,
      sessionExpired: false,
      tokenBlacklisted: false,
      securityChecks: {
        ageCheck: false,
        tokenCheck: false,
        blacklistCheck: false
      }
    }

    // Check session age
    const sessionCreatedAt = new Date(session.created_at || session.issued_at || 0).getTime()
    const sessionAge = Date.now() - sessionCreatedAt
    const maxSessionAge = 8 * 60 * 60 * 1000 // 8 hours

    validationResults.sessionAge = sessionAge
    validationResults.sessionExpired = sessionAge > maxSessionAge
    validationResults.securityChecks.ageCheck = !validationResults.sessionExpired

    // Check if tokens are blacklisted
    if (session.access_token) {
      try {
        validationResults.tokenBlacklisted = await isTokenBlacklisted(session.access_token)
        validationResults.securityChecks.blacklistCheck = !validationResults.tokenBlacklisted
      } catch (error) {
        console.error('❌ Error checking token blacklist:', error)
        validationResults.securityChecks.blacklistCheck = false
      }
    }

    // Validate token with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    validationResults.tokenValid = !!user && !userError
    validationResults.securityChecks.tokenCheck = validationResults.tokenValid

    // Overall validation result
    const isValid = (
      validationResults.sessionExists &&
      validationResults.userExists &&
      validationResults.tokenValid &&
      !validationResults.sessionExpired &&
      !validationResults.tokenBlacklisted
    )

    // Log validation attempt for security monitoring
    console.log('🔍 Enhanced session validation:', {
      userId: session.user?.id?.substring(0, 8) + '...',
      valid: isValid,
      sessionAge: Math.round(sessionAge / (60 * 1000)) + 'min',
      checks: validationResults.securityChecks,
      timestamp: new Date().toISOString()
    })

    if (!isValid) {
      let reason = 'validation_failed'
      if (validationResults.sessionExpired) reason = 'session_expired'
      if (validationResults.tokenBlacklisted) reason = 'token_blacklisted'
      if (!validationResults.tokenValid) reason = 'invalid_token'

      return NextResponse.json({
        valid: false,
        reason,
        details: validationResults,
        message: getValidationMessage(reason)
      }, { status: 401 })
    }

    // Session is valid - return success with metadata
    return NextResponse.json({
      valid: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.user_metadata?.role || 'user'
      },
      session: {
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        age: sessionAge,
        remainingTime: maxSessionAge - sessionAge
      },
      securityChecks: validationResults.securityChecks,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Enhanced session validation error:', error)
    return NextResponse.json({
      valid: false,
      reason: 'validation_error',
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 500 })
  }
}

function getValidationMessage(reason: string): string {
  switch (reason) {
    case 'session_expired':
      return 'Your session has expired. Please sign in again.'
    case 'token_blacklisted':
      return 'Your session is no longer valid. Please sign in again.'
    case 'invalid_token':
      return 'Invalid authentication token. Please sign in again.'
    case 'no_session':
      return 'No active session found. Please sign in.'
    default:
      return 'Session validation failed. Please sign in again.'
  }
}

// GET method for simple session checks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json({ valid: false, reason: 'no_session' }, { status: 401 })
    }

    // Simple age check
    const sessionAge = Date.now() - new Date(session.created_at || session.issued_at || 0).getTime()
    const maxAge = 8 * 60 * 60 * 1000 // 8 hours

    if (sessionAge > maxAge) {
      return NextResponse.json({ valid: false, reason: 'session_expired' }, { status: 401 })
    }

    return NextResponse.json({
      valid: true,
      sessionAge: Math.round(sessionAge / (60 * 1000)) + 'min',
      remainingTime: Math.round((maxAge - sessionAge) / (60 * 1000)) + 'min'
    })
  } catch (error) {
    return NextResponse.json({ valid: false, reason: 'validation_error' }, { status: 500 })
  }
}
