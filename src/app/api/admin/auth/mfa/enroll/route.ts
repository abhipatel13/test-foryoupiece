import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { factorType, phone } = await request.json()

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

    console.log('🔐 MFA Enroll: Starting enrollment for user:', user.id, 'type:', factorType)

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

    if (factorType === 'phone') {
      if (!phone) {
        return NextResponse.json({
          success: false,
          error: 'Phone number is required for phone-based MFA'
        }, { status: 400 })
      }

      // Enroll phone factor
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'phone',
        phone
      })

      if (error) {
        console.log('❌ MFA Enroll: Phone enrollment failed:', error)
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to enroll phone factor'
        }, { status: 400 })
      }

      console.log('✅ MFA Enroll: Phone factor enrolled:', data)

      return NextResponse.json({
        success: true,
        factor: data,
        message: 'Phone factor enrolled successfully. Please verify with the code sent to your phone.'
      })

    } else if (factorType === 'totp') {
      // Enroll TOTP factor (authenticator app)
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      })

      if (error) {
        console.log('❌ MFA Enroll: TOTP enrollment failed:', error)
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to enroll TOTP factor'
        }, { status: 400 })
      }

      console.log('✅ MFA Enroll: TOTP factor enrolled:', data)

      return NextResponse.json({
        success: true,
        factor: data,
        qrCode: data.totp?.qr_code,
        secret: data.totp?.secret,
        message: 'TOTP factor enrolled successfully. Please scan the QR code with your authenticator app.'
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid factor type. Supported types: phone, totp'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ MFA Enroll: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
