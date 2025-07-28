import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { factorId, challengeId, code } = await request.json()

    if (!factorId || !challengeId || !code) {
      return NextResponse.json({
        success: false,
        error: 'Factor ID, challenge ID, and code are required'
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated'
      }, { status: 401 })
    }

    console.log('🔐 MFA Verify: Verifying code for user:', user.id, 'factor:', factorId)

    // Verify the TOTP code
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    })

    if (verifyError) {
      console.log('❌ MFA Verify: Error verifying code:', verifyError)
      return NextResponse.json({
        success: false,
        error: 'Invalid verification code'
      }, { status: 400 })
    }

    console.log('✅ MFA Verify: Code verified successfully')

    return NextResponse.json({
      success: true,
      message: 'MFA verification successful'
    })

  } catch (error) {
    console.error('❌ MFA Verify: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
