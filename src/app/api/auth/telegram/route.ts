import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    
    // Verify Telegram authentication
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
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
    
    const supabase = await createClient()
    
    // Check if user already exists
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', parseInt(telegramData.id))
      .single()
    
    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking existing user:', userError)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }
    
    let user
    
    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          telegram_username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          avatar_url: telegramData.photo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Error updating user:', updateError)
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        )
      }
      
      user = updatedUser
    } else {
      // Create new Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `telegram_${telegramData.id}@foryoupiece.temp`,
        password: crypto.randomBytes(32).toString('hex'),
        options: {
          data: {
            telegram_id: telegramData.id,
            first_name: telegramData.first_name,
            last_name: telegramData.last_name,
            username: telegramData.username,
            avatar_url: telegramData.photo_url
          }
        }
      })
      
      if (authError) {
        console.error('Error creating auth user:', authError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }
      
      if (!authData.user) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }
      
      // Create user profile
      const { data: newUser, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
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
      
      if (profileError) {
        console.error('Error creating user profile:', profileError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
      
      // Add welcome bonus points transaction
      await supabase
        .from('point_transactions')
        .insert({
          user_id: authData.user.id,
          points: 1000,
          transaction_type: 'bonus',
          reference_type: 'signup',
          description: 'Welcome bonus for new Telegram user'
        })
      
      user = newUser
    }
    
    // Create session
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: `telegram_${telegramData.id}@foryoupiece.temp`,
      password: crypto.randomBytes(32).toString('hex')
    })
    
    if (sessionError) {
      // For existing users, we need to sign them in differently
      // This is a simplified approach - in production, you'd want to use custom JWT tokens
      const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously()
      
      if (signInError) {
        console.error('Error signing in user:', signInError)
        return NextResponse.json(
          { error: 'Failed to sign in user' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        telegram_username: user.telegram_username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        points_balance: user.points_balance,
        tier_level: user.tier_level
      }
    })
    
  } catch (error) {
    console.error('Telegram auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
