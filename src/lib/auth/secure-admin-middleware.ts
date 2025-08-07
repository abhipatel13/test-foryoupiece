import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { cookies } from 'next/headers'

// Session configuration (must match the session route)
const SESSION_CONFIG = {
  COOKIE_NAME: 'fyp_admin_session',
  MAX_AGE: 8 * 60 * 60, // 8 hours in seconds
  ROTATION_THRESHOLD: 2 * 60 * 60, // Rotate token after 2 hours
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
 * Get and validate admin session from httpOnly cookie
 */
function getAdminSessionFromCookie(): AdminSession | null {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get(SESSION_CONFIG.COOKIE_NAME)
    
    if (!sessionCookie?.value) {
      return null
    }

    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
    
    // Validate session structure
    if (!sessionData.sessionId || !sessionData.userId || !sessionData.expiresAt) {
      console.warn('🚨 Secure Admin Middleware: Invalid session structure detected')
      return null
    }

    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      console.log('🕐 Secure Admin Middleware: Session expired')
      return null
    }

    return sessionData as AdminSession
  } catch (error) {
    console.error('❌ Secure Admin Middleware: Error parsing session cookie:', error)
    return null
  }
}

/**
 * Verify admin authentication using secure httpOnly cookies
 * Replaces the localStorage-based admin authentication
 */
export async function verifySecureAdminAuth(request: NextRequest): Promise<{
  success: boolean
  user?: any
  adminUser?: any
  session?: AdminSession
  error?: string
  response?: NextResponse
}> {
  try {
    // Get session from httpOnly cookie
    const session = getAdminSessionFromCookie()

    if (!session) {
      console.log('❌ Secure Admin Middleware: No valid session found')
      return {
        success: false,
        error: 'No valid admin session',
        response: NextResponse.json({
          success: false,
          error: 'Authentication required'
        }, { status: 401 })
      }
    }

    // Verify user still exists and has admin privileges using service role client
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      console.error('❌ Secure Admin Middleware: Failed to create service role client')
      return {
        success: false,
        error: 'Authentication system error',
        response: NextResponse.json({
          success: false,
          error: 'Authentication system error'
        }, { status: 500 })
      }
    }

    // Get user data
    const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(session.userId)

    if (userError || !userData.user) {
      console.log('❌ Secure Admin Middleware: User not found or error:', userError?.message)
      return {
        success: false,
        error: 'User not found',
        response: NextResponse.json({
          success: false,
          error: 'Invalid session'
        }, { status: 401 })
      }
    }

    // Check if user still has admin privileges
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.log('❌ Secure Admin Middleware: User no longer has admin privileges:', session.userId)
      return {
        success: false,
        error: 'Admin privileges revoked',
        response: NextResponse.json({
          success: false,
          error: 'Access denied'
        }, { status: 403 })
      }
    }

    // Verify session data matches database
    if (adminUser.id !== session.adminUserId || adminUser.role !== session.role) {
      console.log('❌ Secure Admin Middleware: Session data mismatch detected')
      return {
        success: false,
        error: 'Session integrity violation',
        response: NextResponse.json({
          success: false,
          error: 'Invalid session'
        }, { status: 401 })
      }
    }

    // Enhanced security check for super admin
    if (adminUser.role === 'super_admin') {
      const allowedSuperAdminEmails = [
        process.env.ADMIN_EMAIL,
        process.env.ADMIN_EMAIL_BACKUP
      ].filter(Boolean)

      if (!allowedSuperAdminEmails.includes(userData.user.email || '')) {
        console.log('❌ Secure Admin Middleware: Unauthorized super admin access attempt')
        return {
          success: false,
          error: 'Unauthorized super admin access',
          response: NextResponse.json({
            success: false,
            error: 'Unauthorized access'
          }, { status: 403 })
        }
      }
    }

    // Log successful authentication for security monitoring
    console.log('✅ Secure Admin Middleware: Authentication successful', {
      userId: session.userId,
      email: userData.user.email,
      role: adminUser.role,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      sessionAge: Date.now() - session.createdAt,
      lastRotated: session.lastRotated
    })

    return {
      success: true,
      user: userData.user,
      adminUser,
      session
    }

  } catch (error) {
    console.error('❌ Secure Admin Middleware: Exception during authentication:', error)
    return {
      success: false,
      error: 'Authentication system error',
      response: NextResponse.json({
        success: false,
        error: 'Internal server error'
      }, { status: 500 })
    }
  }
}

/**
 * Secure wrapper function to protect admin API routes
 * Replaces the localStorage-based withAdminAuth function
 */
export function withSecureAdminAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any; session: AdminSession }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Verify secure admin authentication
    const authResult = await verifySecureAdminAuth(request)

    if (!authResult.success) {
      return authResult.response!
    }

    // Add security headers to all admin responses
    const response = await handler(request, {
      user: authResult.user!,
      adminUser: authResult.adminUser!,
      session: authResult.session!
    }, ...args)

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  }
}

/**
 * Middleware specifically for admin dashboard access
 */
export function withSecureAdminDashboardAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any; session: AdminSession }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await verifySecureAdminAuth(request)

    if (!authResult.success) {
      return authResult.response!
    }

    // Additional dashboard-specific security checks
    const session = authResult.session!
    const timeSinceCreation = Date.now() - session.createdAt
    const maxDashboardSessionAge = 12 * 60 * 60 * 1000 // 12 hours

    if (timeSinceCreation > maxDashboardSessionAge) {
      console.log('🕐 Secure Admin Middleware: Dashboard session too old, requiring re-authentication')
      return NextResponse.json({
        success: false,
        error: 'Session expired for dashboard access'
      }, { status: 401 })
    }

    const response = await handler(request, {
      user: authResult.user!,
      adminUser: authResult.adminUser!,
      session: authResult.session!
    }, ...args)

    // Add enhanced security headers for dashboard
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    return response
  }
}

/**
 * Check if session needs rotation (for proactive security)
 */
export function shouldRotateAdminSession(session: AdminSession): boolean {
  const timeSinceRotation = Date.now() - session.lastRotated
  return timeSinceRotation > (SESSION_CONFIG.ROTATION_THRESHOLD * 1000)
}

/**
 * Clear admin session cookie (for logout)
 */
export function clearAdminSessionCookie(): void {
  const cookieStore = cookies()
  cookieStore.delete(SESSION_CONFIG.COOKIE_NAME)
}
