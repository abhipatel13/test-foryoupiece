import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { factorId } = await request.json()

    if (!factorId) {
      return NextResponse.json({
        success: false,
        error: 'Factor ID is required'
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

    console.log('🔐 MFA Challenge: Creating challenge for user:', user.id, 'factor:', factorId)

    // Create a challenge for the TOTP factor
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    })

    if (challengeError) {
      console.log('❌ MFA Challenge: Error creating challenge:', challengeError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create MFA challenge'
      }, { status: 500 })
    }

    console.log('✅ MFA Challenge: Challenge created successfully:', challengeData.id)

    return NextResponse.json({
      success: true,
      challengeId: challengeData.id,
      message: 'MFA challenge created. Please enter your 6-digit code.'
    })

  } catch (error) {
    console.error('❌ MFA Challenge: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
