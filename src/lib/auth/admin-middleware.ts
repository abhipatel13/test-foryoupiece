import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkAdminRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  getUserIdentifier,
  createRateLimitHeaders
} from '@/lib/rate-limiting/admin-rate-limiter'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin authentication middleware for API routes
 * Verifies that the user is authenticated and has admin privileges
 */
export async function verifyAdminAuth(request: NextRequest): Promise<{
  success: boolean
  user?: any
  adminUser?: any
  error?: string
  response?: NextResponse
}> {
  try {
    // Get the authenticated user with retry logic for session timing issues
    const supabase = await createClient()

    if (!supabase) {
      console.error('❌ Failed to create Supabase client')
      return {
        success: false,
        error: 'Authentication system error',
        response: NextResponse.json({
          success: false,
          error: 'Authentication system error'
        }, { status: 500 })
      }
    }

    // Try to get user with retry logic to handle session timing issues
    let user = null
    let authError = null
    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries && !user) {
      const { data: { user: currentUser }, error: currentError } = await supabase.auth.getUser()

      if (currentUser && !currentError) {
        user = currentUser
        break
      }

      authError = currentError
      retryCount++

      if (retryCount < maxRetries) {
        // Wait a short time before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount - 1)))
      }
    }

    if (authError || !user) {
      // Log detailed error information for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Admin API authentication failed after retries:', {
          error: authError?.message || 'No user',
          retryCount,
          endpoint: request.nextUrl.pathname,
          method: request.method,
          timestamp: new Date().toISOString()
        })
      }

      return {
        success: false,
        error: 'Authentication required',
        response: NextResponse.json({
          success: false,
          error: 'Authentication required'
        }, { status: 401 })
      }
    }

    // Check if user has admin privileges using service role client to bypass RLS
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      console.error('❌ Failed to create service role client for admin check')
      return {
        success: false,
        error: 'Authentication system error',
        response: NextResponse.json({
          success: false,
          error: 'Authentication system error'
        }, { status: 500 })
      }
    }

    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    // Handle the case where no admin user is found (PGRST116 is "not found" error)
    if (adminError && adminError.code !== 'PGRST116') {
      console.error('❌ Error checking admin status:', {
        error: adminError,
        userId: user.id,
        email: user.email,
        endpoint: request.nextUrl.pathname,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        error: 'Authentication system error',
        response: NextResponse.json({
          success: false,
          error: 'Authentication system error'
        }, { status: 500 })
      }
    }

    if (!adminUser) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Admin API access denied - user is not an admin:', {
          userId: user.id,
          email: user.email,
          endpoint: request.nextUrl.pathname,
          method: request.method,
          timestamp: new Date().toISOString()
        })
      }
      return {
        success: false,
        error: 'Admin privileges required',
        response: NextResponse.json({
          success: false,
          error: 'Admin privileges required'
        }, { status: 403 })
      }
    }

    // Enhanced security check for super admin
    if (adminUser.role === 'super_admin') {
      const allowedSuperAdminEmails = [
        process.env.ADMIN_EMAIL,
        process.env.ADMIN_EMAIL_BACKUP
      ].filter(Boolean) // Remove undefined values

      if (!allowedSuperAdminEmails.includes(user.email || '')) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Super admin role mismatch - unauthorized access attempt:', {
            userId: user.id,
            email: user.email,
            role: adminUser.role,
            endpoint: request.nextUrl.pathname,
            method: request.method,
            timestamp: new Date().toISOString()
          })
        }
        return {
          success: false,
          error: 'Unauthorized super admin access',
          response: NextResponse.json({
            success: false,
            error: 'Unauthorized access'
          }, { status: 403 })
        }
      }

      // Additional security for super admin: IP validation in production
      if (process.env.NODE_ENV === 'production') {
        const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || []

        if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
          console.error('❌ Super admin IP not allowed:', {
            userId: user.id,
            email: user.email,
            clientIP,
            allowedIPs: allowedIPs.length,
            endpoint: request.nextUrl.pathname,
            timestamp: new Date().toISOString()
          })
          return {
            success: false,
            error: 'Access denied from this location',
            response: NextResponse.json({
              success: false,
              error: 'Access denied'
            }, { status: 403 })
          }
        }
      }
    }

    // Session validation - check if session is still valid
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) {
      console.error('❌ Invalid session detected:', {
        userId: user.id,
        email: user.email,
        sessionError: sessionError?.message,
        endpoint: request.nextUrl.pathname,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        error: 'Session expired',
        response: NextResponse.json({
          success: false,
          error: 'Session expired'
        }, { status: 401 })
      }
    }

    // Check session age for admin operations (max 8 hours)
    const sessionAge = Date.now() - new Date(sessionData.session.created_at).getTime()
    const maxSessionAge = 8 * 60 * 60 * 1000 // 8 hours in milliseconds

    if (sessionAge > maxSessionAge) {
      console.error('❌ Admin session too old:', {
        userId: user.id,
        email: user.email,
        sessionAge: Math.round(sessionAge / (60 * 60 * 1000)) + ' hours',
        endpoint: request.nextUrl.pathname,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        error: 'Session expired - please re-authenticate',
        response: NextResponse.json({
          success: false,
          error: 'Session expired - please re-authenticate'
        }, { status: 401 })
      }
    }

    // Log admin API access with security context
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Admin API access granted:', {
        userId: user.id,
        email: user.email,
        role: adminUser.role,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString()
      })
    } else {
      // In production, log only essential security information
      console.log('✅ Admin API access:', {
        userId: user.id.substring(0, 8) + '...',
        role: adminUser.role,
        endpoint: request.nextUrl.pathname,
        timestamp: new Date().toISOString()
      })
    }

    return {
      success: true,
      user,
      adminUser
    }
  } catch (error) {
    console.error('❌ Admin authentication middleware error:', error)
    return {
      success: false,
      error: 'Authentication system error',
      response: NextResponse.json({
        success: false,
        error: 'Authentication system error'
      }, { status: 500 })
    }
  }
}

/**
 * Wrapper function to protect admin API routes with rate limiting
 * Usage: export const GET = withAdminAuth(async (request, { user, adminUser }) => { ... })
 */
export function withAdminAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any }, ...args: T) => Promise<NextResponse>,
  options: { rateLimitType?: 'admin_api' | 'admin_access' | 'admin_bulk_operations' | 'admin_boxhero_sync' } = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Apply rate limiting first
    const rateLimitType = options.rateLimitType || 'admin_api'
    const clientIdentifier = getClientIdentifier(request)

    const rateLimitResult = await checkAdminRateLimit(clientIdentifier, rateLimitType)

    if (!rateLimitResult.allowed) {
      console.log(`🚫 Admin API: Rate limit exceeded for ${rateLimitType}:`, clientIdentifier)
      return createRateLimitResponse(rateLimitResult)
    }

    // Then verify admin authentication
    const authResult = await verifyAdminAuth(request)

    if (!authResult.success) {
      return authResult.response!
    }

    // Execute the handler and add rate limit headers to the response
    const response = await handler(request, {
      user: authResult.user!,
      adminUser: authResult.adminUser!
    }, ...args)

    // Add rate limit headers to successful responses
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Specialized wrapper for admin dashboard access with user-specific rate limiting
 * Usage: export const GET = withAdminDashboardAuth(async (request, { user, adminUser }) => { ... })
 */
export function withAdminDashboardAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // First verify admin authentication to get user info
    const authResult = await verifyAdminAuth(request)

    if (!authResult.success) {
      return authResult.response!
    }

    // Apply user-specific rate limiting for dashboard access
    const userIdentifier = getUserIdentifier(authResult.user!.id, request)
    const rateLimitResult = await checkAdminRateLimit(userIdentifier, 'admin_access')

    if (!rateLimitResult.allowed) {
      console.log('🚫 Admin Dashboard: Rate limit exceeded for user:', authResult.user!.id)
      return createRateLimitResponse(rateLimitResult)
    }

    // Execute the handler and add rate limit headers to the response
    const response = await handler(request, {
      user: authResult.user!,
      adminUser: authResult.adminUser!
    }, ...args)

    // Add rate limit headers to successful responses
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Legacy wrapper function without rate limiting (for backward compatibility)
 * Usage: export const GET = withAdminAuthLegacy(async (request, { user, adminUser }) => { ... })
 */
export function withAdminAuthLegacy<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await verifyAdminAuth(request)

    if (!authResult.success) {
      return authResult.response!
    }

    return handler(request, {
      user: authResult.user!,
      adminUser: authResult.adminUser!
    }, ...args)
  }
}
