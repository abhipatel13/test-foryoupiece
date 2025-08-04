import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Enhanced admin authentication with better reliability
interface AdminAuthCache {
  [userId: string]: {
    adminUser: any
    timestamp: number
    ttl: number
  }
}

// In-memory cache for admin status (5 minute TTL)
const adminAuthCache: AdminAuthCache = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Enhanced admin authentication with caching and better error handling
 */
export async function verifyAdminAuthEnhanced(request: NextRequest): Promise<{
  success: boolean
  user?: any
  adminUser?: any
  error?: string
  response?: NextResponse
}> {
  try {
    // Create Supabase client with timeout
    const supabase = await createClient()
    
    if (!supabase) {
      return {
        success: false,
        error: 'Authentication system error',
        response: NextResponse.json({
          success: false,
          error: 'Authentication system error'
        }, { status: 500 })
      }
    }

    // Get authenticated user with single attempt (no retry loop)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        response: NextResponse.json({
          success: false,
          error: 'Authentication required'
        }, { status: 401 })
      }
    }

    // Check cache first
    const cached = adminAuthCache[user.id]
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return {
        success: true,
        user,
        adminUser: cached.adminUser
      }
    }

    // Query admin status with service role client
    const serviceClient = createServiceRoleClient()
    
    if (!serviceClient) {
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

    // Handle admin query errors
    if (adminError && adminError.code !== 'PGRST116') {
      console.error('❌ Error checking admin status:', adminError)
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
      // Cache negative result for 1 minute to prevent repeated queries
      adminAuthCache[user.id] = {
        adminUser: null,
        timestamp: Date.now(),
        ttl: 60 * 1000 // 1 minute for negative results
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
      ].filter(Boolean)

      if (!allowedSuperAdminEmails.includes(user.email || '')) {
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

    // Cache positive result for 5 minutes
    adminAuthCache[user.id] = {
      adminUser,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    }

    return {
      success: true,
      user,
      adminUser
    }

  } catch (error) {
    console.error('❌ Admin authentication error:', error)
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
 * Clear admin auth cache for a specific user
 */
export function clearAdminAuthCache(userId: string) {
  delete adminAuthCache[userId]
}

/**
 * Clear all admin auth cache
 */
export function clearAllAdminAuthCache() {
  Object.keys(adminAuthCache).forEach(key => delete adminAuthCache[key])
}

/**
 * Enhanced wrapper with better error handling and caching
 */
export function withEnhancedAdminAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any; adminUser: any }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await verifyAdminAuthEnhanced(request)

    if (!authResult.success) {
      return authResult.response!
    }

    try {
      return await handler(request, {
        user: authResult.user!,
        adminUser: authResult.adminUser!
      }, ...args)
    } catch (error) {
      console.error('❌ Admin handler error:', error)
      return NextResponse.json({
        success: false,
        error: 'Internal server error'
      }, { status: 500 })
    }
  }
}
