import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated'
      }, { status: 401 })
    }

    console.log('🔐 MFA Enroll: Starting enrollment for user:', user.id)

    // Restrict MFA enrollment to super admin only (akito12350@gmail.com)
    const allowedMfaEmails = ['akito12350@gmail.com']

    if (!allowedMfaEmails.includes(user.email || '')) {
      console.log('❌ MFA Enroll: MFA enrollment restricted to super admin only:', user.email)
      return NextResponse.json({
        success: false,
        error: 'MFA enrollment is restricted to super admin accounts only. Regular users do not need MFA for security and password reset simplicity.'
      }, { status: 403 })
    }

    console.log('✅ MFA Enroll: Super admin email verified, proceeding with enrollment')

    // Enroll a new TOTP factor
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Super Admin Authenticator'
    })

    if (enrollError) {
      console.log('❌ MFA Enroll: Error enrolling factor:', enrollError)
      return NextResponse.json({
        success: false,
        error: 'Failed to enroll MFA factor'
      }, { status: 500 })
    }

    console.log('✅ MFA Enroll: Factor enrolled successfully:', enrollData.id)

    return NextResponse.json({
      success: true,
      factorId: enrollData.id,
      qrCode: enrollData.totp.qr_code,
      secret: enrollData.totp.secret,
      uri: enrollData.totp.uri,
      message: 'MFA factor enrolled. Please scan the QR code with your authenticator app.'
    })

  } catch (error) {
    console.error('❌ MFA Enroll: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
