import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminQueries } from '@/lib/supabase/queries'

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

    // First, authenticate the user with email/password
    console.log('🔐 Admin Login: Attempting authentication for email:', email)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      console.log('❌ Admin Login: Authentication failed:', authError?.message)
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

      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 })
    }

    console.log('✅ Admin Login: Admin privileges confirmed for user:', authData.user.id, 'role:', adminUser.role)

    // Check if user has MFA factors enrolled
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    
    if (factorsError) {
      console.log('❌ Admin Login: Error checking MFA factors:', factorsError)
      return NextResponse.json({
        success: false,
        error: 'Error checking authentication factors'
      }, { status: 500 })
    }

    console.log('🔍 Admin Login: MFA factors:', factors)

    // Check if user has any verified factors
    const hasVerifiedFactors = factors.totp.length > 0 || factors.phone.length > 0

    if (!hasVerifiedFactors) {
      // No MFA enrolled - require enrollment for admin users
      console.log('⚠️ Admin Login: No MFA factors enrolled, requiring enrollment')
      
      return NextResponse.json({
        success: true,
        requiresMfaEnrollment: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: adminUser.role
        },
        message: 'MFA enrollment required for admin access'
      })
    }

    // Check current assurance level
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    
    if (aalError) {
      console.log('❌ Admin Login: Error checking assurance level:', aalError)
      return NextResponse.json({
        success: false,
        error: 'Error checking authentication level'
      }, { status: 500 })
    }

    console.log('🔍 Admin Login: Current assurance level:', aal)

    if (aal.currentLevel === 'aal1') {
      // User needs to complete MFA challenge
      console.log('⚠️ Admin Login: MFA challenge required')
      
      return NextResponse.json({
        success: true,
        requiresMfaChallenge: true,
        factors: factors,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: adminUser.role
        },
        message: 'Multi-factor authentication required'
      })
    }

    // User is fully authenticated with MFA (aal2)
    console.log('✅ Admin Login: Full authentication successful with MFA')
    
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: adminUser.role
      },
      message: 'Admin login successful'
    })

  } catch (error) {
    console.error('❌ Admin Login: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
