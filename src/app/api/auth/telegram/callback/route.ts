import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import crypto from 'crypto'

interface TelegramAuthData {
  id: string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

/**
 * Verify Telegram OAuth authentication data
 */
function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data

  // Create data-check-string by sorting keys alphabetically and joining with newlines
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n')

  // Create secret key by hashing the bot token with SHA256
  const secretKey = crypto.createHash('sha256').update(botToken).digest()

  // Create HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(dataCheckString)
  const calculatedHash = hmac.digest('hex')

  // Compare hashes
  return calculatedHash === hash
}

/**
 * Check if auth data is not too old (within 24 hours)
 */
function isAuthDataFresh(authDate: string): boolean {
  const authTimestamp = parseInt(authDate)
  const now = Math.floor(Date.now() / 1000)
  const maxAge = 24 * 60 * 60 // 24 hours in seconds
  return (now - authTimestamp) <= maxAge
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  
  console.log('🔄 Telegram OAuth callback received')
  console.log('📥 Search params:', Object.fromEntries(searchParams.entries()))

  try {
    // Extract Telegram auth data from URL parameters
    const telegramData: TelegramAuthData = {
      id: searchParams.get('id') || '',
      first_name: searchParams.get('first_name') || '',
      last_name: searchParams.get('last_name') || undefined,
      username: searchParams.get('username') || undefined,
      photo_url: searchParams.get('photo_url') || undefined,
      auth_date: searchParams.get('auth_date') || '',
      hash: searchParams.get('hash') || ''
    }

    // Validate required fields
    if (!telegramData.id || !telegramData.first_name || !telegramData.auth_date || !telegramData.hash) {
      console.error('❌ Missing required Telegram authentication data')
      return NextResponse.redirect(`${origin}/en/auth/login?error=missing_telegram_data`)
    }

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN
    if (!botToken) {
      console.error('❌ TELEGRAM_AUTH_BOT_TOKEN not configured')
      return NextResponse.redirect(`${origin}/en/auth/login?error=telegram_not_configured`)
    }

    // Verify the authentication data
    if (!verifyTelegramAuth(telegramData, botToken)) {
      console.error('❌ Telegram auth verification failed for user:', telegramData.id)
      return NextResponse.redirect(`${origin}/en/auth/login?error=telegram_verification_failed`)
    }

    // Check if auth data is fresh
    if (!isAuthDataFresh(telegramData.auth_date)) {
      console.error('❌ Telegram auth data too old for user:', telegramData.id)
      return NextResponse.redirect(`${origin}/en/auth/login?error=telegram_auth_expired`)
    }

    console.log('✅ Telegram auth verified for user:', telegramData.id, telegramData.username)

    // Use service role client to manage users
    const supabaseAdmin = createServiceRoleClient()
    
    // Check if user already exists by telegram_id
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, telegram_id')
      .eq('telegram_id', telegramData.id)
      .single()

    let userId: string
    let isNewUser = false

    if (existingProfile) {
      // User exists, use their existing user_id
      userId = existingProfile.user_id
      console.log('✅ Existing Telegram user found:', userId)
    } else {
      // Create new user
      isNewUser = true
      
      // Generate a unique email for Telegram users
      const telegramEmail = `telegram_${telegramData.id}@telegram.foryoupiece.com`
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: telegramEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          photo_url: telegramData.photo_url,
          auth_provider: 'telegram'
        }
      })

      if (authError || !authData.user) {
        console.error('❌ Failed to create user:', authError)
        return NextResponse.redirect(`${origin}/en/auth/login?error=user_creation_failed`)
      }

      userId = authData.user.id
      console.log('✅ New Telegram user created:', userId)

      // Create user profile
      const { error: profileInsertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: telegramEmail,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          avatar_url: telegramData.photo_url,
          tier_level: 'bronze',
          total_points: 0,
          available_points: 0,
          total_spent: 0,
          total_orders: 0
        })

      if (profileInsertError) {
        console.error('❌ Failed to create user profile:', profileInsertError)
        // Don't fail the auth, just log the error
      }

      // Award signup bonus for new users
      if (isNewUser) {
        try {
          const signupBonus = 1000 // 1000 points signup bonus
          
          const { error: bonusError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              total_points: signupBonus,
              available_points: signupBonus
            })
            .eq('user_id', userId)

          if (!bonusError) {
            // Log the bonus transaction
            await supabaseAdmin
              .from('points_transactions')
              .insert({
                user_id: userId,
                points: signupBonus,
                type: 'earned',
                description: 'Welcome bonus for new account',
                reference_type: 'signup_bonus',
                reference_id: userId
              })

            console.log('✅ Signup bonus awarded:', signupBonus, 'points to user:', userId)
          }
        } catch (bonusError) {
          console.error('❌ Failed to award signup bonus:', bonusError)
          // Don't fail the auth for bonus errors
        }
      }
    }

    // Generate a session token for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: existingProfile?.email || `telegram_${telegramData.id}@telegram.foryoupiece.com`,
      options: {
        redirectTo: `${origin}/en/auth/callback?telegram_auth=success`
      }
    })

    if (sessionError || !sessionData) {
      console.error('❌ Failed to generate session:', sessionError)
      return NextResponse.redirect(`${origin}/en/auth/login?error=session_creation_failed`)
    }

    console.log('✅ Telegram OAuth authentication successful for user:', userId)
    console.log('🔗 Redirecting to magic link for session creation')

    // Redirect to the magic link to establish the session
    return NextResponse.redirect(sessionData.properties?.action_link || `${origin}/en`)

  } catch (error) {
    console.error('❌ Telegram OAuth callback error:', error)
    return NextResponse.redirect(`${origin}/en/auth/login?error=telegram_callback_error`)
  }
}
