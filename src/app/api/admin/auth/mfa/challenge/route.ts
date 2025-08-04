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

    console.log('🔐 MFA Challenge: Creating challenge for user:', user.id, 'factor:', factorId)

    // Create MFA challenge
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId
    })

    if (error) {
      console.log('❌ MFA Challenge: Challenge creation failed:', error)
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to create MFA challenge'
      }, { status: 400 })
    }

    console.log('✅ MFA Challenge: Challenge created:', data)

    return NextResponse.json({
      success: true,
      challengeId: data.id,
      message: 'MFA challenge created. Please enter the verification code.'
    })

  } catch (error) {
    console.error('❌ MFA Challenge: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
