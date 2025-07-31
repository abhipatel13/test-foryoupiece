import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TEST: Telegram auth API called')
    
    // Check environment variables first
    const requiredEnvVars = {
      TELEGRAM_AUTH_BOT_TOKEN: process.env.TELEGRAM_AUTH_BOT_TOKEN,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
    }
    
    console.log('🔍 TEST: Environment variables check:', {
      TELEGRAM_AUTH_BOT_TOKEN: requiredEnvVars.TELEGRAM_AUTH_BOT_TOKEN ? '✅ Set' : '❌ Missing',
      SUPABASE_SERVICE_ROLE_KEY: requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
      NEXT_PUBLIC_SUPABASE_URL: requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'
    })

    // Check for missing environment variables
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key)
    
    if (missingVars.length > 0) {
      console.error('❌ TEST: Missing environment variables:', missingVars)
      return NextResponse.json({ 
        error: 'Server configuration error', 
        details: `Missing environment variables: ${missingVars.join(', ')}` 
      }, { status: 500 })
    }

    console.log('📥 TEST: Parsing request body...')
    const body = await request.json()
    const telegramData = body.user as TelegramAuthData
    const redirectTo = body.redirectTo || '/'

    console.log('🔄 TEST: Telegram auth request received:', {
      id: telegramData?.id,
      username: telegramData?.username,
      first_name: telegramData?.first_name,
      hasAuthDate: !!telegramData?.auth_date,
      hasHash: !!telegramData?.hash
    })

    // Validate required fields
    if (!telegramData || !telegramData.id || !telegramData.first_name) {
      console.error('❌ TEST: Missing required Telegram data fields')
      return NextResponse.json({ error: 'Missing required Telegram data' }, { status: 400 })
    }

    // SKIP HASH VERIFICATION FOR TESTING
    console.log('⚠️ TEST: Skipping Telegram hash verification for testing purposes')

    const email = `telegram_${telegramData.id}@foryoupiece.temp`
    console.log('📧 TEST: Generated email:', email)

    console.log('🔍 TEST: Checking if user exists in auth.users...')
    // First, check if user exists in auth.users
    const { data: authUsers, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers()

    if (authSearchError) {
      console.error('❌ TEST: Error searching auth users:', authSearchError)
      return NextResponse.json({ 
        error: 'Failed to search users', 
        details: authSearchError.message 
      }, { status: 500 })
    }

    console.log('📊 TEST: Found', authUsers.users.length, 'total auth users')
    const existingAuthUser = authUsers.users.find(u => u.email === email)

    let authUserId: string

    if (existingAuthUser) {
      console.log('✅ TEST: Existing auth user found:', existingAuthUser.id)
      authUserId = existingAuthUser.id
    } else {
      console.log('👤 TEST: Creating new auth user...')
      // Create new auth user
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramData.id,
          username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          avatar_url: telegramData.photo_url,
          provider: 'telegram'
        }
      })

      if (createAuthError || !newAuthUser.user) {
        console.error('❌ TEST: Error creating auth user:', createAuthError)
        return NextResponse.json({ 
          error: 'Failed to create auth user', 
          details: createAuthError?.message || 'No user returned' 
        }, { status: 500 })
      }

      authUserId = newAuthUser.user.id
      console.log('✅ TEST: New auth user created:', authUserId)
    }

    console.log('🔑 TEST: Generating magic link for email:', email)

    // Generate magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('❌ TEST: Error generating magic link:', linkError)
      return NextResponse.json({ 
        error: 'Failed to generate session', 
        details: linkError?.message || 'No hashed token returned' 
      }, { status: 500 })
    }

    console.log('✅ TEST: Magic link generated successfully, verifying OTP...')

    // Immediately verify the magic link to get a session
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (otpError || !otpData?.session) {
      console.error('❌ TEST: Error verifying OTP:', otpError)
      return NextResponse.json({ 
        error: 'Failed to create session', 
        details: otpError?.message || 'No session returned' 
      }, { status: 500 })
    }

    console.log('✅ TEST: Session created successfully for user:', otpData.user?.id)
    console.log('🔄 TEST: Returning session tokens to client')

    // Return the session tokens
    return NextResponse.json({
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
      user: otpData.user,
      redirectTo,
      test: true
    })

  } catch (error) {
    console.error('❌ TEST: Telegram auth error:', error)
    console.error('❌ TEST: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
