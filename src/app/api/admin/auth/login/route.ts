import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminQueries } from '@/lib/supabase/queries'
import {
  checkAdminRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  createRateLimitHeaders,
  checkAndSendLoginAttemptAlert
} from '@/lib/rate-limiting/admin-rate-limiter'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for admin login attempts
    const clientIdentifier = getClientIdentifier(request)
    const rateLimitResult = await checkAdminRateLimit(clientIdentifier, 'admin_login')

    if (!rateLimitResult.allowed) {
      console.log('🚫 Admin Login: Rate limit exceeded for client:', clientIdentifier)
      return createRateLimitResponse(rateLimitResult)
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 })
    }

    // Create server-side Supabase client
    const supabase = await createClient()

    // First, authenticate the user with email/password
    console.log('🔐 Admin Login: Attempting authentication for email:', email)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      console.log('❌ Admin Login: Authentication failed:', authError?.message)

      // Check if we should send email notification for failed attempts
      await checkAndSendLoginAttemptAlert(clientIdentifier, request, email)

      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      }, { status: 401 })
    }

    console.log('✅ Admin Login: Authentication successful for user:', authData.user.id)

    // Check if user is admin using server-side query
    console.log('🔍 Admin Login: Checking admin privileges for user:', authData.user.id)
    
    // Direct database query with service role permissions
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .single()

    console.log('🔍 Admin Login: Admin user query result:', { adminUser, adminError })

    if (adminError || !adminUser) {
      console.log('❌ Admin Login: User is not an admin:', authData.user.id)

      // Sign out the user since they're not an admin
      await supabase.auth.signOut()

      // Check if we should send email notification for failed admin access attempts
      await checkAndSendLoginAttemptAlert(clientIdentifier, request, email)

      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 })
    }

    console.log('✅ Admin Login: Admin privileges confirmed for user:', authData.user.id, 'role:', adminUser.role)

    // Admin login successful - no 2FA required
    console.log('✅ Admin Login: Authentication successful')

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: adminUser.role
      },
      message: 'Admin login successful'
    }, { headers: rateLimitHeaders })

  } catch (error) {
    console.error('❌ Admin Login: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
