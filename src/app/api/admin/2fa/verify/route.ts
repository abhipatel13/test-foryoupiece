import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminQueries } from '@/lib/supabase/queries'
import { Admin2FAService } from '@/lib/services/admin-2fa-service'

export async function POST(request: NextRequest) {
  try {
    const { sessionToken, verificationCode } = await request.json()

    if (!sessionToken || !verificationCode) {
      return NextResponse.json({
        success: false,
        error: 'Session token and verification code are required'
      }, { status: 400 })
    }

    const supabase = await createClient()
    const admin2FAService = new Admin2FAService()

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || undefined

    // Get the admin session
    const session = await admin2FAService.getAdminSession(sessionToken)

    if (!session) {
      await admin2FAService.logSecurityEvent({
        userId: '',
        eventType: '2fa_failed',
        eventDescription: 'Invalid session token for 2FA verification',
        ipAddress,
        userAgent,
        severity: 'warning',
        metadata: { sessionToken: sessionToken.substring(0, 8) + '...' }
      })

      return NextResponse.json({
        success: false,
        error: 'Invalid or expired session'
      }, { status: 401 })
    }

    // Verify the 2FA token
    const verificationResult = await admin2FAService.verify2FAToken(
      session.id,
      verificationCode,
      ipAddress
    )

    if (!verificationResult.success) {
      return NextResponse.json({
        success: false,
        error: verificationResult.error || 'Invalid verification code'
      }, { status: 401 })
    }

    // Get user and admin details
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // If user is not authenticated, we need to sign them in
    if (userError || !user) {
      // Get user details from the session
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('email')
        .eq('id', session.userId)
        .single()

      if (fetchError || !userData) {
        return NextResponse.json({
          success: false,
          error: 'Failed to retrieve user information'
        }, { status: 500 })
      }

      // Create a new session for the user
      // Note: In a production environment, you might want to use a more secure method
      // to re-authenticate the user after 2FA verification
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: 'temp_password_for_2fa' // This is a placeholder - implement proper session restoration
      })

      if (signInError) {
        console.error('Error re-authenticating user after 2FA:', signInError)
        // For now, we'll proceed without re-authentication
        // In production, implement proper session restoration
      }
    }

    // Get admin user details
    const adminUser = await adminQueries.getAdminUser(session.userId)

    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: 'Admin user not found'
      }, { status: 404 })
    }

    // Log successful 2FA verification and login
    await admin2FAService.logSecurityEvent({
      userId: session.userId,
      eventType: 'login_success',
      eventDescription: `Admin login successful after 2FA verification`,
      ipAddress,
      userAgent,
      severity: 'info',
      metadata: { 
        sessionId: session.id,
        email: user?.email || 'unknown',
        role: adminUser.role
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: user?.email || 'unknown',
        role: adminUser.role
      },
      message: 'Two-factor authentication successful. Admin access granted.'
    })
  } catch (error) {
    console.error('Error in admin 2FA verification:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
