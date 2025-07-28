import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { factorId, challengeId, code } = await request.json()

    if (!factorId || !challengeId || !code) {
      return NextResponse.json({
        success: false,
        error: 'Factor ID, challenge ID, and verification code are required'
      }, { status: 400 })
    }

    // Create server-side Supabase client
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated'
      }, { status: 401 })
    }

    console.log('🔐 MFA Verify: Verifying code for user:', user.id, 'factor:', factorId)

    // Verify the MFA challenge
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      challengeId,
      code
    })

    if (error) {
      console.log('❌ MFA Verify: Verification failed:', error)
      return NextResponse.json({
        success: false,
        error: error.message || 'Invalid verification code'
      }, { status: 400 })
    }

    console.log('✅ MFA Verify: Verification successful:', data)

    // Check if user is admin (since they passed MFA)
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.log('❌ MFA Verify: User is not an admin after MFA:', user.id)
      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: adminUser.role
      },
      message: 'Multi-factor authentication successful. Admin access granted.'
    })

  } catch (error) {
    console.error('❌ MFA Verify: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
