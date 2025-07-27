import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
        process.env.NEXT_PUBLIC_ADMIN_EMAIL,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_BACKUP
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
 * Wrapper function to protect admin API routes
 * Usage: export const GET = withAdminAuth(async (request, { user, adminUser }) => { ... })
 */
export function withAdminAuth<T extends any[]>(
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
