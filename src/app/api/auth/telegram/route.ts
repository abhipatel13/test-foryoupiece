import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import crypto from 'crypto'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

/**
 * Verify Telegram authentication data
 * Based on Telegram's official documentation: https://core.telegram.org/widgets/login
 */
function verifyTelegramAuth(data: TelegramUser, botToken: string): boolean {
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
function isAuthDataFresh(authDate: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  const maxAge = 24 * 60 * 60 // 24 hours in seconds
  return (now - authDate) <= maxAge
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Telegram auth API called')
    const telegramUser: TelegramUser = await request.json()
    console.log('📥 Received Telegram user data:', {
      id: telegramUser.id,
      first_name: telegramUser.first_name,
      username: telegramUser.username,
      auth_date: telegramUser.auth_date,
      hasHash: !!telegramUser.hash
    })

    // Validate required fields
    if (!telegramUser.id || !telegramUser.first_name || !telegramUser.auth_date || !telegramUser.hash) {
      console.error('❌ Missing required Telegram authentication data:', {
        hasId: !!telegramUser.id,
        hasFirstName: !!telegramUser.first_name,
        hasAuthDate: !!telegramUser.auth_date,
        hasHash: !!telegramUser.hash
      })
      return NextResponse.json({
        success: false,
        error: 'Missing required Telegram authentication data'
      }, { status: 400 })
    }

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN
    if (!botToken) {
      console.error('❌ TELEGRAM_AUTH_BOT_TOKEN not configured')
      return NextResponse.json({
        success: false,
        error: 'Telegram authentication not configured'
      }, { status: 500 })
    }

    // Verify the authentication data
    if (!verifyTelegramAuth(telegramUser, botToken)) {
      console.error('❌ Telegram auth verification failed for user:', telegramUser.id)
      return NextResponse.json({
        success: false,
        error: 'Invalid Telegram authentication data'
      }, { status: 401 })
    }

    // Check if auth data is fresh
    if (!isAuthDataFresh(telegramUser.auth_date)) {
      console.error('❌ Telegram auth data too old for user:', telegramUser.id)
      return NextResponse.json({
        success: false,
        error: 'Authentication data expired'
      }, { status: 401 })
    }

    console.log('✅ Telegram auth verified for user:', telegramUser.id, telegramUser.username)

    // Use service role client to manage users
    const supabaseAdmin = createServiceRoleClient()
    
    // Check if user already exists by telegram_id
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, telegram_id')
      .eq('telegram_id', telegramUser.id.toString())
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
      const telegramEmail = `telegram_${telegramUser.id}@telegram.foryoupiece.com`
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: telegramEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramUser.id,
          telegram_username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          photo_url: telegramUser.photo_url,
          auth_provider: 'telegram'
        }
      })

      if (authError || !authData.user) {
        console.error('❌ Failed to create user:', authError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create user account'
        }, { status: 500 })
      }

      userId = authData.user.id
      console.log('✅ New Telegram user created:', userId)

      // Create user profile
      const { error: profileInsertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: telegramEmail,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          telegram_id: telegramUser.id.toString(),
          telegram_username: telegramUser.username,
          avatar_url: telegramUser.photo_url,
          tier_level: 'bronze',
          total_points: 0,
          available_points: 0,
          total_spent: 0,
          total_orders: 0
        })

      if (profileInsertError) {
        console.error('❌ Failed to create user profile:', profileInsertError)
        // Don't fail the request, profile can be created later
      }

      // Award signup bonus for new users
      if (isNewUser) {
        try {
          const signupBonus = 1000 // 1000 points = $1 signup bonus
          
          const { error: pointsError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              total_points: signupBonus,
              available_points: signupBonus
            })
            .eq('user_id', userId)

          if (!pointsError) {
            // Record the signup bonus transaction
            await supabaseAdmin
              .from('loyalty_transactions')
              .insert({
                user_id: userId,
                type: 'earned',
                points: signupBonus,
                description: 'Welcome bonus for new account',
                reference_type: 'signup_bonus',
                reference_id: userId
              })
            
            console.log('✅ Signup bonus awarded:', signupBonus, 'points to user:', userId)
          }
        } catch (error) {
          console.error('❌ Failed to award signup bonus:', error)
          // Don't fail the request for bonus errors
        }
      }
    }

    // Create a session for the user
    const supabase = await createClient()
    
    // Generate a session token for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: existingProfile?.email || `telegram_${telegramUser.id}@telegram.foryoupiece.com`,
      options: {
        redirectTo: `${request.nextUrl.origin}/en/auth/callback`
      }
    })

    if (sessionError || !sessionData) {
      console.error('❌ Failed to generate session:', sessionError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create session'
      }, { status: 500 })
    }

    console.log('✅ Telegram authentication successful for user:', userId)
    console.log('🔗 Generated magic link:', sessionData.properties?.action_link ? 'Yes' : 'No')

    const response = {
      success: true,
      user: {
        id: userId,
        telegram_id: telegramUser.id,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        username: telegramUser.username,
        photo_url: telegramUser.photo_url,
        is_new_user: isNewUser
      },
      redirect_url: sessionData.properties?.action_link
    }

    console.log('📤 Sending response:', { ...response, redirect_url: response.redirect_url ? 'Present' : 'Missing' })
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Telegram auth error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
