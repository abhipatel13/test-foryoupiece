import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Session configuration
const SESSION_CONFIG = {
  COOKIE_NAME: 'fyp_admin_session',
  MAX_AGE: 8 * 60 * 60, // 8 hours in seconds
  ROTATION_THRESHOLD: 2 * 60 * 60, // Rotate token after 2 hours
  SECURE: process.env.NODE_ENV === 'production',
  HTTP_ONLY: true,
  SAME_SITE: 'lax' as const,
  PATH: '/'
}

interface AdminSession {
  sessionId: string
  userId: string
  adminUserId: string
  role: string
  email: string
  createdAt: number
  lastRotated: number
  expiresAt: number
}

/**
 * Generate a cryptographically secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create session data with expiration
 */
function createSessionData(user: any, adminUser: any): AdminSession {
  const now = Date.now()
  return {
    sessionId: generateSessionToken(),
    userId: user.id,
    adminUserId: adminUser.id,
    role: adminUser.role,
    email: user.email,
    createdAt: now,
    lastRotated: now,
    expiresAt: now + (SESSION_CONFIG.MAX_AGE * 1000)
  }
}

/**
 * Set secure httpOnly cookie
 */
function setSessionCookie(sessionData: AdminSession): void {
  const cookieStore = cookies()
  const encryptedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64')
  
  cookieStore.set(SESSION_CONFIG.COOKIE_NAME, encryptedSession, {
    httpOnly: SESSION_CONFIG.HTTP_ONLY,
    secure: SESSION_CONFIG.SECURE,
    sameSite: SESSION_CONFIG.SAME_SITE,
    maxAge: SESSION_CONFIG.MAX_AGE,
    path: SESSION_CONFIG.PATH
  })
}

/**
 * Clear session cookie
 */
function clearSessionCookie(): void {
  const cookieStore = cookies()
  cookieStore.delete(SESSION_CONFIG.COOKIE_NAME)
}

/**
 * Get and validate session from cookie
 */
function getSessionFromCookie(): AdminSession | null {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get(SESSION_CONFIG.COOKIE_NAME)
    
    if (!sessionCookie?.value) {
      return null
    }

    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
    
    // Validate session structure
    if (!sessionData.sessionId || !sessionData.userId || !sessionData.expiresAt) {
      console.warn('🚨 Invalid session structure detected')
      return null
    }

    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      console.log('🕐 Admin session expired')
      return null
    }

    return sessionData as AdminSession
  } catch (error) {
    console.error('❌ Error parsing session cookie:', error)
    return null
  }
}

/**
 * Check if session needs rotation
 */
function shouldRotateSession(session: AdminSession): boolean {
  const timeSinceRotation = Date.now() - session.lastRotated
  return timeSinceRotation > (SESSION_CONFIG.ROTATION_THRESHOLD * 1000)
}

/**
 * Rotate session token for enhanced security
 */
function rotateSession(session: AdminSession): AdminSession {
  return {
    ...session,
    sessionId: generateSessionToken(),
    lastRotated: Date.now(),
    expiresAt: Date.now() + (SESSION_CONFIG.MAX_AGE * 1000)
  }
}

/**
 * POST /api/admin/session - Create admin session (login)
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 })
    }

    // Create server-side Supabase client
    const supabase = await createClient()

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      console.log('❌ Admin Session: Authentication failed:', authError?.message)
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      }, { status: 401 })
    }

    // Check admin privileges using service role client
    const serviceClient = createServiceRoleClient()
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.log('❌ Admin Session: User is not an admin:', authData.user.id)
      await supabase.auth.signOut()
      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 })
    }

    // Enhanced security check for super admin
    if (adminUser.role === 'super_admin') {
      const allowedSuperAdminEmails = [
        process.env.ADMIN_EMAIL,
        process.env.ADMIN_EMAIL_BACKUP
      ].filter(Boolean)

      if (!allowedSuperAdminEmails.includes(authData.user.email || '')) {
        console.log('❌ Admin Session: Unauthorized super admin access attempt')
        await supabase.auth.signOut()
        return NextResponse.json({
          success: false,
          error: 'Unauthorized access'
        }, { status: 403 })
      }
    }

    // Create secure session
    const sessionData = createSessionData(authData.user, adminUser)
    setSessionCookie(sessionData)

    console.log('✅ Admin Session: Created secure session for user:', authData.user.id, 'role:', adminUser.role)

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: adminUser.role
      },
      session: {
        expiresAt: sessionData.expiresAt,
        createdAt: sessionData.createdAt
      },
      message: 'Admin session created successfully'
    })

  } catch (error) {
    console.error('❌ Admin Session: Exception during login:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/session - Validate and refresh admin session
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromCookie()

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No valid session found'
      }, { status: 401 })
    }

    // Verify user still exists and has admin privileges
    const serviceClient = createServiceRoleClient()
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.log('❌ Admin Session: User no longer has admin privileges:', session.userId)
      clearSessionCookie()
      return NextResponse.json({
        success: false,
        error: 'Admin privileges revoked'
      }, { status: 403 })
    }

    // Check if session needs rotation
    let currentSession = session
    if (shouldRotateSession(session)) {
      console.log('🔄 Admin Session: Rotating session token for enhanced security')
      currentSession = rotateSession(session)
      setSessionCookie(currentSession)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        role: session.role
      },
      session: {
        expiresAt: currentSession.expiresAt,
        createdAt: currentSession.createdAt,
        lastRotated: currentSession.lastRotated,
        rotated: currentSession !== session
      },
      message: 'Session validated successfully'
    })

  } catch (error) {
    console.error('❌ Admin Session: Exception during validation:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/session - Logout and clear session
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromCookie()
    
    if (session) {
      console.log('🚪 Admin Session: Logging out user:', session.userId)
    }

    // Clear the session cookie
    clearSessionCookie()

    // Also sign out from Supabase
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Warning: Failed to sign out from Supabase:', error)
      // Continue with logout even if Supabase sign out fails
    }

    return NextResponse.json({
      success: true,
      message: 'Admin session cleared successfully'
    })

  } catch (error) {
    console.error('❌ Admin Session: Exception during logout:', error)
    // Still clear the cookie even if there's an error
    clearSessionCookie()
    
    return NextResponse.json({
      success: true,
      message: 'Admin session cleared'
    })
  }
}
