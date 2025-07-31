import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN!
  const { hash, ...dataToCheck } = data

  const dataCheckArr = Object.entries(dataToCheck)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckArr).digest('hex')

  return hmac === hash
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
    console.log('🚀 Telegram auth API called')

    // Check environment variables first
    const requiredEnvVars = {
      TELEGRAM_AUTH_BOT_TOKEN: process.env.TELEGRAM_AUTH_BOT_TOKEN,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
    }

    console.log('🔍 Environment variables check:', {
      TELEGRAM_AUTH_BOT_TOKEN: requiredEnvVars.TELEGRAM_AUTH_BOT_TOKEN ? '✅ Set' : '❌ Missing',
      SUPABASE_SERVICE_ROLE_KEY: requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
      NEXT_PUBLIC_SUPABASE_URL: requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'
    })

    // Check for missing environment variables
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      console.error('❌ Missing environment variables:', missingVars)
      return NextResponse.json({
        error: 'Server configuration error',
        details: `Missing environment variables: ${missingVars.join(', ')}`
      }, { status: 500 })
    }

    console.log('📥 Parsing request body...')
    const body = await request.json()
    const telegramData = body.user as TelegramAuthData
    const redirectTo = body.redirectTo || '/'

    console.log('🔄 Telegram auth request received:', {
      id: telegramData?.id,
      username: telegramData?.username,
      first_name: telegramData?.first_name,
      hasAuthDate: !!telegramData?.auth_date,
      hasHash: !!telegramData?.hash
    })

    // Validate required fields
    if (!telegramData || !telegramData.id || !telegramData.first_name) {
      console.error('❌ Missing required Telegram data fields')
      return NextResponse.json({ error: 'Missing required Telegram data' }, { status: 400 })
    }

    console.log('🔐 Verifying Telegram authentication...')
    // Verify Telegram authentication
    if (!verifyTelegramAuth(telegramData)) {
      console.error('❌ Telegram authentication verification failed')
      return NextResponse.json({ error: 'Invalid authentication data' }, { status: 401 })
    }
    console.log('✅ Telegram authentication verified')

    // Check if auth date is not too old (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000)
    if (currentTime - telegramData.auth_date > 300) {
      console.error('❌ Authentication data too old:', {
        currentTime,
        authDate: telegramData.auth_date,
        diff: currentTime - telegramData.auth_date
      })
      return NextResponse.json({ error: 'Authentication data is too old' }, { status: 401 })
    }
    console.log('✅ Authentication date is valid')

    const email = `telegram_${telegramData.id}@foryoupiece.com`
    console.log('📧 Generated email:', email)

    console.log('🔍 Checking if user exists in auth.users...')
    // First, check if user exists in auth.users
    const { data: authUsers, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers()

    if (authSearchError) {
      console.error('❌ Error searching auth users:', authSearchError)
      return NextResponse.json({
        error: 'Failed to search users',
        details: authSearchError.message
      }, { status: 500 })
    }

    console.log('📊 Found', authUsers.users.length, 'total auth users')
    const existingAuthUser = authUsers.users.find(u => u.email === email)

    let authUserId: string

    if (existingAuthUser) {
      console.log('✅ Existing auth user found:', existingAuthUser.id)
      // User exists, update their metadata
      authUserId = existingAuthUser.id

      console.log('🔄 Updating existing user metadata...')
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        {
          user_metadata: {
            telegram_id: telegramData.id,
            username: telegramData.username,
            first_name: telegramData.first_name,
            last_name: telegramData.last_name,
            avatar_url: telegramData.photo_url,
            provider: 'telegram'
          }
        }
      )

      if (updateError) {
        console.error('❌ Error updating auth user:', updateError)
        return NextResponse.json({
          error: 'Failed to update user',
          details: updateError.message
        }, { status: 500 })
      }
      console.log('✅ User metadata updated successfully')
    } else {
      console.log('👤 Creating new auth user...')
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
        console.error('❌ Error creating auth user:', createAuthError)
        return NextResponse.json({
          error: 'Failed to create auth user',
          details: createAuthError?.message || 'No user returned'
        }, { status: 500 })
      }

      authUserId = newAuthUser.user.id
      console.log('✅ New auth user created:', authUserId)
    }

    console.log('🔍 Checking if user profile exists...')
    // Check if user profile exists
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking user profile:', profileError)
      return NextResponse.json({
        error: 'Failed to check user profile',
        details: profileError.message
      }, { status: 500 })
    }

    // If no profile exists, create one
    if (!existingProfile) {
      console.log('📝 Creating new user profile...')
      // Create user profile with correct schema
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          email,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          avatar_url: telegramData.photo_url,
          tier_level: 'bronze',
          points_balance: 1000
        })

      if (insertError) {
        console.error('❌ Error creating user profile:', insertError)
        return NextResponse.json({
          error: 'Failed to create user profile',
          details: insertError.message
        }, { status: 500 })
      }
      console.log('✅ User profile created successfully')

      console.log('🎁 Creating welcome bonus transaction...')
      // Create welcome bonus transaction for new users
      const { error: transactionError } = await supabaseAdmin
        .from('point_transactions')
        .insert({
          user_id: authUserId,
          points: 1000,
          transaction_type: 'bonus',
          reference_type: 'signup',
          description: 'Welcome bonus for new Telegram user'
        })

      if (transactionError) {
        console.error('⚠️ Error creating welcome bonus transaction:', transactionError)
        // Don't fail the auth process for bonus transaction errors
      } else {
        console.log('✅ Welcome bonus transaction created')
      }
    } else {
      console.log('✅ Existing user profile found:', existingProfile.id)
    }

    console.log('🔑 Generating magic link for email:', email)

    // Generate magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('❌ Error generating magic link:', linkError)
      return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 })
    }

    console.log('✅ Magic link generated successfully, verifying OTP...')

    // Immediately verify the magic link to get a session
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (otpError || !otpData?.session) {
      console.error('❌ Error verifying OTP:', otpError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    console.log('✅ Session created successfully for user:', otpData.user?.id)
    console.log('🔄 Returning session tokens to client')

    // Return the session tokens
    return NextResponse.json({
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
      user: otpData.user,
      redirectTo
    })

  } catch (error) {
    console.error('❌ Telegram auth error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Provide more specific error information in development
    const isDevelopment = process.env.NODE_ENV === 'development'

    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: 500 }
    )
  }
}
