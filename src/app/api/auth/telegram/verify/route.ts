import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Telegram Login Widget Verification Endpoint
 * 
 * This endpoint handles the redirect from Telegram Login Widget in redirect mode.
 * It verifies the signature, creates/links users, and establishes Supabase sessions.
 * 
 * Security Features:
 * - HMAC-SHA256 signature verification
 * - Auth date freshness validation (10 minutes)
 * - Rate limiting protection
 * - Production-only functionality
 * - Server-side session creation (no third-party cookies)
 */

interface TelegramAuthData {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false
  }
  
  record.count++
  return true
}

function verifyTelegramAuthFromParams(params: URLSearchParams, botToken: string): boolean {
  // Build data-check-string from EXACT params received (excluding 'hash')
  const entries: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hash' && value !== undefined && value !== null && value !== '') {
      entries.push(`${key}=${value}`)
    }
  })
  const dataCheckString = entries.sort().join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const hmac = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return hmac === (params.get('hash') || '')
}

function isAuthDateValid(authDate: string): boolean {
  const authTimestamp = parseInt(authDate) * 1000
  const now = Date.now()
  const tenMinutes = 10 * 60 * 1000
  
  return (now - authTimestamp) <= tenMinutes
}

export async function GET(request: NextRequest) {
  try {
    // Production-only check
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚫 Telegram auth is production-only')
      return NextResponse.redirect(new URL('/en/auth/login?error=dev_mode', request.url))
    }

    // Rate limiting
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      console.log('🚫 Rate limit exceeded for IP:', ip)
      return NextResponse.redirect(new URL('/en/auth/login?error=rate_limit', request.url))
    }

    // Get bot token
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN
    if (!botToken) {
      console.error('❌ TELEGRAM_AUTH_BOT_TOKEN not configured')
      return NextResponse.redirect(new URL('/en/auth/login?error=config_error', request.url))
    }

    // Parse query parameters (do not coerce/omit values)
    const url = new URL(request.url)
    const params = url.searchParams

    // Validate required fields
    const id = params.get('id') || ''
    const auth_date = params.get('auth_date') || ''
    const hash = params.get('hash') || ''
    if (!id || !auth_date || !hash) {
      console.log('🚫 Missing required Telegram auth data')
      return NextResponse.redirect(new URL('/en/auth/login?error=invalid_data', request.url))
    }

    // Verify signature using exact params
    if (!verifyTelegramAuthFromParams(params, botToken)) {
      console.log('🚫 Invalid Telegram signature')
      return NextResponse.redirect(new URL('/en/auth/login?error=invalid_signature', request.url))
    }

    // Verify auth date freshness
    if (!isAuthDateValid(auth_date)) {
      console.log('🚫 Telegram auth data too old')
      return NextResponse.redirect(new URL('/en/auth/login?error=expired_auth', request.url))
    }

    // Build typed authData from params after signature verified
    const authData: TelegramAuthData = {
      id,
      first_name: params.get('first_name') || undefined,
      last_name: params.get('last_name') || undefined,
      username: params.get('username') || undefined,
      photo_url: params.get('photo_url') || undefined,
      auth_date,
      hash,
    }

    console.log('✅ Telegram auth verified for user:', authData.id)

    // Create clients: SSR for cookies, service role for admin ops
    const supabaseSSR = await createClient()
    const supabaseAdmin = createServiceRoleClient()
    if (!supabaseSSR || !supabaseAdmin) {
      console.error('❌ Failed to create Supabase clients')
      return NextResponse.redirect(new URL('/en/auth/login?error=server_error', request.url))
    }

    // Create synthetic email for Telegram users
    const syntheticEmail = `tg_${authData.id}@telegram.foryoupiece.local`

    // Check if user already exists
    const { data: existingUser } = await supabaseSSR
      .from('users')
      .select('id')
      .eq('telegram_id', parseInt(authData.id))
      .single()

    let userId: string

    if (existingUser) {
      // User exists, use existing ID
      userId = existingUser.id
      console.log('👤 Existing Telegram user found:', userId.substring(0, 8) + '...')
    } else {
      // Create new user via Supabase Admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: parseInt(authData.id),
          telegram_username: authData.username,
          first_name: authData.first_name,
          last_name: authData.last_name,
          photo_url: authData.photo_url,
          auth_provider: 'telegram',
          created_via: 'telegram_login_widget'
        }
      })

      if (createError || !newUser.user) {
        console.error('❌ Failed to create user:', createError)
        return NextResponse.redirect(new URL('/en/auth/login?error=user_creation_failed', request.url))
      }

      userId = newUser.user.id
      console.log('✅ New Telegram user created:', userId.substring(0, 8) + '...')

      // Create user profile in users table
      const { error: profileError } = await supabaseSSR
        .from('users')
        .insert({
          id: userId,
          telegram_id: parseInt(authData.id),
          telegram_username: authData.username,
          email: syntheticEmail,
          first_name: authData.first_name,
          last_name: authData.last_name,
          avatar_url: authData.photo_url,
          points_balance: 1000, // New user signup bonus
          preferred_language: 'en'
        })

      if (profileError) {
        console.error('❌ Failed to create user profile:', profileError)
        // Continue anyway, as the auth user was created
      }
    }

    // Generate magic link for server-side session creation
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail
    })

    if (linkError || !linkData.properties?.email_otp) {
      console.error('❌ Failed to generate magic link:', linkError)
      return NextResponse.redirect(new URL('/en/auth/login?error=session_creation_failed', request.url))
    }

    // Verify OTP to create session (this sets cookies)
    const { data: sessionData, error: sessionError } = await supabaseSSR.auth.verifyOtp({
      type: 'email',
      email: syntheticEmail,
      token: linkData.properties.email_otp
    })

    if (sessionError || !sessionData.session) {
      console.error('❌ Failed to create session:', sessionError)
      return NextResponse.redirect(new URL('/en/auth/login?error=session_creation_failed', request.url))
    }

    console.log('✅ Telegram login successful for user:', userId.substring(0, 8) + '...')

    // Redirect to success page; SSR client already set auth cookies via verifyOtp
    const redirectUrl = new URL('/en/profile?auth=telegram_success', request.url)
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('❌ Telegram auth error:', error)
    return NextResponse.redirect(new URL('/en/auth/login?error=server_error', request.url))
  }
}
