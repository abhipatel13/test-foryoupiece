import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import crypto from 'crypto'

interface TelegramAuthData {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data
  
  // Create data-check-string
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n')
  
  // Create secret key
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  
  // Create hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  
  return calculatedHash === hash
}

export async function POST(request: NextRequest) {
  try {
    const telegramData: TelegramAuthData = await request.json()

    console.log('🔄 Telegram auth request received:', {
      id: telegramData.id,
      username: telegramData.username,
      first_name: telegramData.first_name
    })

    // Verify required fields
    if (!telegramData.id || !telegramData.first_name) {
      return NextResponse.json(
        { error: 'Missing required Telegram data' },
        { status: 400 }
      )
    }

    // Verify Telegram authentication - use the auth bot token
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram authentication bot token not configured' },
        { status: 500 }
      )
    }

    if (!verifyTelegramAuth(telegramData, botToken)) {
      return NextResponse.json(
        { error: 'Invalid Telegram authentication' },
        { status: 401 }
      )
    }

    // Check if auth data is not too old (5 minutes)
    const authDate = parseInt(telegramData.auth_date)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 300) {
      return NextResponse.json(
        { error: 'Authentication data is too old' },
        { status: 401 }
      )
    }

    // Use service role client for admin operations
    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service client not available' },
        { status: 500 }
      )
    }

    const telegramEmail = `telegram_${telegramData.id}@foryoupiece.temp`

    // First check if user profile exists in our database (by telegram_id)
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', parseInt(telegramData.id))
      .single()

    let authUser

    if (existingProfile && existingProfile.id) {
      // User exists, get their auth user
      console.log('🔄 Found existing user profile, getting auth user')
      const { data: existingAuthUser, error: authUserError } = await supabase.auth.admin.getUserById(existingProfile.id)

      if (authUserError || !existingAuthUser.user) {
        console.error('❌ Error getting existing auth user:', authUserError)
        return NextResponse.json(
          { error: 'Failed to retrieve user account' },
          { status: 500 }
        )
      }

      // Update auth user metadata
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        existingAuthUser.user.id,
        {
          user_metadata: {
            ...existingAuthUser.user.user_metadata,
            telegram_id: telegramData.id,
            first_name: telegramData.first_name,
            last_name: telegramData.last_name,
            username: telegramData.username,
            avatar_url: telegramData.photo_url,
            provider: 'telegram'
          }
        }
      )

      if (updateError) {
        console.error('❌ Error updating auth user metadata:', updateError)
      }

      authUser = updateData?.user || existingAuthUser.user
    } else {
      // Create new Supabase auth user
      console.log('🆕 Creating new Telegram auth user')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: telegramEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramData.id,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          username: telegramData.username,
          avatar_url: telegramData.photo_url,
          provider: 'telegram'
        }
      })

      if (authError || !authData.user) {
        console.error('❌ Error creating auth user:', authError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }

      authUser = authData.user
    }

    // Now handle user profile in the database
    console.log('🔄 Handling user profile in database')

    let userProfile

    if (existingProfile) {
      // Update existing profile
      console.log('🔄 Updating existing user profile')
      const { data: updatedProfile, error: updateError } = await supabase
        .from('users')
        .update({
          telegram_username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          avatar_url: telegramData.photo_url,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', parseInt(telegramData.id))
        .select()
        .single()

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError)
        return NextResponse.json(
          { error: 'Failed to update user profile' },
          { status: 500 }
        )
      }

      userProfile = updatedProfile
    } else {
      // Create new user profile with welcome bonus
      console.log('🆕 Creating new user profile with welcome bonus')
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id, // The user ID is the auth user ID
          telegram_id: parseInt(telegramData.id),
          telegram_username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          avatar_url: telegramData.photo_url,
          points_balance: 1000, // Welcome bonus
          tier_level: 'bronze'
        })
        .select()
        .single()

      if (createError) {
        console.error('❌ Error creating user profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }

      // Add welcome bonus points transaction
      await supabase
        .from('point_transactions')
        .insert({
          user_id: newProfile.id,
          points: 1000,
          type: 'earned',
          description: 'Welcome bonus for new Telegram user',
          created_at: new Date().toISOString()
        })

      userProfile = newProfile
    }

    // Create a session for the user using admin API
    console.log('🔑 Creating session for user:', authUser.id)

    // Get the base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectDestination = telegramData.redirectTo || '/'

    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: telegramEmail,
      options: {
        redirectTo: `${baseUrl}/en/auth/callback?redirectTo=${encodeURIComponent(redirectDestination)}`
      }
    })

    if (sessionError) {
      console.error('❌ Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create user session' },
        { status: 500 }
      )
    }

    console.log('✅ Telegram authentication successful for user:', authUser.id)

    return NextResponse.json({
      success: true,
      authUrl: sessionData.action_link,
      user: {
        id: userProfile.id,
        telegram_id: userProfile.telegram_id,
        telegram_username: userProfile.telegram_username,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        avatar_url: userProfile.avatar_url,
        points_balance: userProfile.points_balance,
        tier_level: userProfile.tier_level
      }
    })

  } catch (error) {
    console.error('❌ Telegram auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
