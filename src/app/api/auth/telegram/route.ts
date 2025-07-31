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
    const body = await request.json()
    const telegramData = body.user as TelegramAuthData
    const redirectTo = body.redirectTo || '/'

    console.log('🔄 Telegram auth request received:', {
      id: telegramData.id,
      username: telegramData.username,
      first_name: telegramData.first_name
    })

    // Verify Telegram authentication
    if (!verifyTelegramAuth(telegramData)) {
      return NextResponse.json({ error: 'Invalid authentication data' }, { status: 401 })
    }

    // Check if auth date is not too old (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000)
    if (currentTime - telegramData.auth_date > 300) {
      return NextResponse.json({ error: 'Authentication data is too old' }, { status: 401 })
    }

    const email = `telegram_${telegramData.id}@foryoupiece.temp`

    // First, check if user exists in auth.users
    const { data: authUsers, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers()

    if (authSearchError) {
      console.error('Error searching auth users:', authSearchError)
      return NextResponse.json({ error: 'Failed to search users' }, { status: 500 })
    }

    const existingAuthUser = authUsers.users.find(u => u.email === email)

    let authUserId: string

    if (existingAuthUser) {
      // User exists, update their metadata
      authUserId = existingAuthUser.id

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
        console.error('Error updating auth user:', updateError)
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
      }
    } else {
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
        console.error('Error creating auth user:', createAuthError)
        return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
      }

      authUserId = newAuthUser.user.id
    }

    // Check if user profile exists
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking user profile:', profileError)
      return NextResponse.json({ error: 'Failed to check user profile' }, { status: 500 })
    }

    // If no profile exists, create one
    if (!existingProfile) {
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
        console.error('Error creating user profile:', insertError)
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
      }

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
        console.error('Error creating welcome bonus transaction:', transactionError)
      }
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
    console.error('Telegram auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
