import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/lib/supabase/database.types'

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

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 Telegram auth verification started at:', new Date().toISOString())

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

    // Get bot token with fallback
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('❌ TELEGRAM_AUTH_BOT_TOKEN not configured')
      console.error('🔍 Available Telegram env vars:', {
        hasAuthToken: !!process.env.TELEGRAM_AUTH_BOT_TOKEN,
        hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasStockToken: !!process.env.TELEGRAM_STOCK_BOT_TOKEN
      })
      return NextResponse.redirect(new URL('/en/auth/login?error=config_error', request.url))
    }

    console.log('✅ Using bot token:', botToken.substring(0, 10) + '...')

function isDuplicateUserErrorMessage(msg: string): boolean {
  if (!msg) return false
  const lower = msg.toLowerCase()
  return (
    lower.includes('already registered') ||
    lower.includes('user already') ||
    lower.includes('already exists') ||
    lower.includes('email already') ||
    lower.includes('duplicate key') ||
    lower.includes('duplicate') ||
    lower.includes('exists') ||
    lower.includes('unique constraint') ||
    lower.includes('violates unique') ||
    lower.includes('constraint') ||
    lower.includes('auth.users_email_key') ||
    lower.includes('users_email_key') ||
    lower.includes('email_key') ||
    lower.includes('taken') ||
    lower.includes('in use') ||
    lower.includes('registered')
  )
}
    // Parse query parameters (do not coerce/omit values)
    const url = new URL(request.url)
    const params = url.searchParams

    // Debug: incoming params keys and basic metadata (no secrets)
    try {
      const paramKeys = Array.from(params.keys())
      console.log('🧭 Incoming Telegram verify params:', paramKeys)
      console.log('🧭 Basic identifiers:', {
        id: params.get('id') ? String(params.get('id')).slice(-6) : 'none',
        has_username: !!params.get('username'),
        has_photo_url: !!params.get('photo_url'),
        has_hash: !!params.get('hash'),
        auth_date: params.get('auth_date')
      })
      console.log('🌐 Request IP header:', request.headers.get('x-forwarded-for') || request.ip || 'unknown')
    } catch {}

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

    // Validate service role client has proper configuration
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      console.error('❌ Missing Supabase configuration:', {
        hasServiceKey: !!serviceRoleKey,
        hasUrl: !!supabaseUrl,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      })
      return NextResponse.redirect(new URL('/en/auth/login?error=config_error', request.url))
    }

    // Log environment status for debugging
    console.log('🔧 Environment check:', {
      hasServiceKey: !!serviceRoleKey,
      hasUrl: !!supabaseUrl,
      serviceKeyLength: serviceRoleKey?.length,
      urlDomain: supabaseUrl ? new URL(supabaseUrl).hostname : 'invalid',
      nodeEnv: process.env.NODE_ENV
    })

    // Create synthetic email for Telegram users
    const syntheticEmail = `tg_${authData.id}@telegram.foryoupiece.local`

    // TEMPORARILY DISABLED: New user redirect to broken deep-link flow
    // The widget flow is sophisticated enough to handle new users
    // try {
    //   const { data: existingByTelegram } = await supabaseAdmin
    //     .from('users')
    //     .select('id')
    //     .eq('telegram_id', parseInt(authData.id))
    //     .maybeSingle?.() || { data: null }

    //   if (!existingByTelegram) {
    //     console.log('🧭 New Telegram user detected via verify route; redirecting to deeplink fallback')
    //     const fallbackUrl = new URL('/en/auth/login', request.url)
    //     fallbackUrl.searchParams.set('error', 'telegram_widget_new_user_flow')
    //     fallbackUrl.searchParams.set('fallback', 'deeplink')
    //     return NextResponse.redirect(fallbackUrl)
    //   }
    // } catch (e) {
    //   console.warn('⚠️ Failed to check existing telegram user; proceeding with cautious flow:', e)
    // }

    console.log('✅ Proceeding with widget flow for all users (new user redirect disabled)')

    // 1) Try to generate a magic link first — if it works, the auth user already exists
    let emailOtp: string | null = null
    let hashedToken: string | null = null
    let initialLinkError: any = null
    {
      const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: syntheticEmail,
      })
      if (!error && linkData?.properties?.email_otp) {
        emailOtp = linkData.properties.email_otp
        hashedToken = (linkData as any)?.properties?.token_hash || (linkData as any)?.properties?.email_otp_hash || (linkData as any)?.properties?.hashed_token || null
        try {
          const propKeys = Object.keys(linkData.properties || {})
          console.log('🔑 Magic link generated (existing user). Properties:', {
            keys: propKeys,
            has_email_otp: !!linkData.properties.email_otp,
            email_otp_length: String(linkData.properties.email_otp || '').length,
            has_token_hash: !!((linkData as any)?.properties?.token_hash),
            has_email_otp_hash: !!((linkData as any)?.properties?.email_otp_hash),
            has_hashed_token: !!((linkData as any)?.properties?.hashed_token),
          })
        } catch {}
        console.log('🔑 Existing auth user detected via magic link generation')
      } else {
        initialLinkError = error
        console.log('ℹ️ Magic link not available yet; will attempt to create auth user', error?.message || error)
      }
    }

    // 2) If magic link was not generated, create user (handle duplicates gracefully), then generate link again
    if (!emailOtp) {
      console.log('🔄 Attempting to create auth user for:', syntheticEmail)

      // Add validation for required fields
      if (!authData.id || isNaN(parseInt(authData.id))) {
        console.error('❌ Invalid Telegram ID:', authData.id)
        return NextResponse.redirect(new URL('/en/auth/login?error=invalid_telegram_id', request.url))
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: parseInt(authData.id),
          username: authData.username || null,
          telegram_username: authData.username || null,
          first_name: authData.first_name || null,
          last_name: authData.last_name || null,
          photo_url: authData.photo_url || null,
          auth_provider: 'telegram',
          created_via: 'telegram_login_widget',
        },
      })

      if (createError) {
        const msg = String(createError?.message || createError || '')
        console.error('🚨 CreateUser error details:', {
          message: msg,
          code: createError?.code,
          status: createError?.status,
          details: createError?.details,
          hint: createError?.hint,
          fullError: createError
        })

        // Treat duplicate/registered user as non-fatal (cover various Supabase/PG wordings)
        if (isDuplicateUserErrorMessage(msg)) {
          console.warn('⚠️ Auth user already exists; continuing with login flow:', msg)
        } else {
          // Do not fail here; proceed to attempt magic link generation regardless.
          console.warn('⚠️ Non-duplicate createUser error; attempting magic link anyway:', msg)
        }
      } else if (newUser?.user?.id) {
        console.log('✅ Created new auth user:', newUser.user.id.substring(0, 8) + '...')
      }

      // Always try generating magic link again (even after createUser errors, in case user exists)
      // Add transient-consistency handling and retries to avoid "Database error saving new user"
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

      // If we got a new user id, confirm visibility via admin.getUserById before attempting generateLink
      if ((newUser as any)?.user?.id) {
        try {
          const { data: fetchedUser, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById((newUser as any).user.id)
          console.log('🧾 Post-create fetch user check:', { hasUser: !!fetchedUser?.user, fetchError: fetchErr?.message })
        } catch (e) {
          console.warn('⚠️ Post-create fetch user check threw:', e)
        }
      }

      // Retry strategy for generateLink to mitigate supabase auth race conditions
      const retryDelays = [0, 300, 800] // ms
      let linkData2: any = null
      let linkError2: any = null
      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        const delay = retryDelays[attempt]
        if (delay > 0) await sleep(delay)
        console.log(`🔄 Attempting to generate magic link for: ${syntheticEmail} (attempt ${attempt + 1}/${retryDelays.length}, delay ${delay}ms)`)
        const res = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: syntheticEmail,
        })
        linkData2 = res.data
        linkError2 = res.error

        try {
          const propKeys2 = Object.keys(linkData2?.properties || {})
          console.log('🧪 Magic link properties after createUser (attempt):', {
            keys: propKeys2,
            has_email_otp: !!linkData2?.properties?.email_otp,
            email_otp_length: String(linkData2?.properties?.email_otp || '').length,
            has_token_hash: !!((linkData2 as any)?.properties?.token_hash),
            has_email_otp_hash: !!((linkData2 as any)?.properties?.email_otp_hash),
            has_hashed_token: !!((linkData2 as any)?.properties?.hashed_token),
            error: linkError2?.message,
            errorCode: linkError2?.code,
            status: linkError2?.status,
          })
        } catch {}

        if (!linkError2 && linkData2?.properties?.email_otp) {
          break
        }
      }

      if (linkError2 || !linkData2?.properties?.email_otp) {
        console.error('❌ Failed to generate magic link after user creation (after retries):', {
          error: linkError2?.message,
          code: linkError2?.code,
          status: linkError2?.status,
          hasEmailOtp: !!linkData2?.properties?.email_otp,
          syntheticEmail,
          telegramId: authData.id
        })

        // Try one more time with a different approach - check if user exists first
        try {
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers({
            filter: `email.eq.${syntheticEmail}`
          })

          if (existingUser?.users?.length > 0) {
            console.log('✅ User exists, attempting final magic link generation')
            const { data: finalLinkData, error: finalLinkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: syntheticEmail,
            })

            if (!finalLinkError && finalLinkData?.properties?.email_otp) {
              emailOtp = finalLinkData.properties.email_otp
              hashedToken = (finalLinkData as any)?.properties?.token_hash || null
              console.log('✅ Final magic link generation successful')
            } else {
              throw new Error(`Final magic link failed: ${finalLinkError?.message}`)
            }
          } else {
            throw new Error('User not found after creation')
          }
        } catch (finalError) {
          console.error('❌ All magic link attempts failed:', finalError)
          return NextResponse.redirect(new URL('/en/auth/login?error=auth_system_error', request.url))
        }
      }

      emailOtp = linkData2.properties.email_otp
      hashedToken = (linkData2 as any)?.properties?.token_hash || (linkData2 as any)?.properties?.email_otp_hash || (linkData2 as any)?.properties?.hashed_token || null
      console.log('✅ Generated magic link successfully')
    }

    // 3) Create session preferring token_hash (magiclink) path first for reliability
    console.log('🔄 Creating session (prefer magiclink token_hash)...')
    let sessionData: any = null
    let sessionError: any = null

    // Prefer token_hash if available from initial generateLink
    if (hashedToken) {
      console.time('verifyOtp-primary-magiclink-token-hash')
      const { data, error } = await supabaseSSR.auth.verifyOtp({
        type: 'magiclink',
        token_hash: hashedToken as string,
      })
      console.timeEnd('verifyOtp-primary-magiclink-token-hash')
      sessionData = data
      sessionError = error
      console.log('ℹ️ verifyOtp(magiclink, token_hash) result:', {
        hasSession: !!sessionData?.session,
        errorMessage: sessionError?.message,
        errorCode: sessionError?.code,
      })
    }

    // If no session yet, try email OTP path (works in poll route)
    if ((!sessionData || !sessionData.session) && emailOtp) {
      console.time('verifyOtp-primary-email')
      const { data, error } = await supabaseSSR.auth.verifyOtp({
        type: 'email',
        email: syntheticEmail,
        token: emailOtp,
      })
      console.timeEnd('verifyOtp-primary-email')
      // Only override if still no session
      if (!sessionData?.session) {
        sessionData = data
        sessionError = error
      }
      console.log('ℹ️ verifyOtp(email, email_otp) result:', {
        hasSession: !!sessionData?.session,
        errorMessage: sessionError?.message,
        errorCode: sessionError?.code,
      })
    }

    if (!emailOtp && !hashedToken) {
      console.error('❌ Missing both emailOtp and token_hash from generateLink properties')
      sessionError = new Error('Missing emailOtp/token_hash')
    }

    // Fallback: Generate a fresh magic link and retry (token_hash first, then email)
    if (sessionError || !sessionData?.session) {
      console.log('🔄 Primary verification failed, generating fresh magic link and retrying...')
      try {
        console.time('generateLink-fallback')
        const { data: freshLinkData, error: freshLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: syntheticEmail,
        })
        console.timeEnd('generateLink-fallback')
        const freshEmailOtp = freshLinkData?.properties?.email_otp
        const freshHash = (freshLinkData as any)?.properties?.token_hash || (freshLinkData as any)?.properties?.email_otp_hash || (freshLinkData as any)?.properties?.hashed_token

        if (!freshLinkError && freshHash) {
          console.time('verifyOtp-retry-magiclink-token-hash')
          const { data: retryHashData, error: retryHashError } = await supabaseSSR.auth.verifyOtp({
            type: 'magiclink',
            token_hash: freshHash as string,
          })
          console.timeEnd('verifyOtp-retry-magiclink-token-hash')
          sessionData = retryHashData
          sessionError = retryHashError
          console.log('ℹ️ Retry verifyOtp(magiclink, token_hash) result:', {
            hasSession: !!sessionData?.session,
            errorMessage: sessionError?.message,
            errorCode: sessionError?.code,
          })
        }

        if ((!sessionData || !sessionData.session) && !freshLinkError && freshEmailOtp) {
          console.time('verifyOtp-retry-email')
          const { data: retryData, error: retryError } = await supabaseSSR.auth.verifyOtp({
            type: 'email',
            email: syntheticEmail,
            token: freshEmailOtp,
          })
          console.timeEnd('verifyOtp-retry-email')
          sessionData = retryData
          sessionError = retryError
          console.log('ℹ️ Retry verifyOtp(email, otp) result:', {
            hasSession: !!sessionData?.session,
            errorMessage: sessionError?.message,
            errorCode: sessionError?.code,
          })
        }

        if ((!sessionData || !sessionData.session) && !freshLinkError && (freshLinkData as any)?.properties?.action_link) {
          try {
            const actionLink = (freshLinkData as any).properties.action_link as string
            const url = new URL(actionLink)
            const tokenHashParam = url.searchParams.get('token_hash')
            const typeParam = url.searchParams.get('type')
            console.log('🧵 Parsed action_link params:', { hasTokenHash: !!tokenHashParam, typeParam })
            if (tokenHashParam) {
              console.time('verifyOtp-retry-action-link-token-hash')
              const { data: actionRetryData, error: actionRetryError } = await supabaseSSR.auth.verifyOtp({
                type: 'magiclink',
                token_hash: tokenHashParam,
              })
              console.timeEnd('verifyOtp-retry-action-link-token-hash')
              sessionData = actionRetryData
              sessionError = actionRetryError
              console.log('ℹ️ Retry via action_link token_hash result:', {
                hasSession: !!sessionData?.session,
                errorMessage: sessionError?.message,
                errorCode: sessionError?.code,
              })
            } else {
              console.error('❌ action_link missing token_hash')
            }
          } catch (parseErr) {
            console.error('❌ Failed to parse action_link for token_hash:', parseErr)
          }
        }

        if (freshLinkError) {
          console.error('❌ Failed to generate fresh magic link:', freshLinkError)
        }
      } catch (e) {
        console.error('❌ Fresh magic link retry threw:', e)
      }

      if (sessionError || !sessionData?.session) {
        console.error('❌ All session creation attempts failed:', {
          finalError: sessionError,
          hasSession: !!sessionData?.session,
          syntheticEmail,
          authDataId: authData.id
        })
        return NextResponse.redirect(new URL('/en/auth/login?error=session_creation_failed', request.url))
      }
    }

    const sessionUserId = sessionData.session.user.id

    // 4) Upsert profile using service role (bypass RLS). Set 1000 points only if new.
    let isNewProfile = false
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, points_balance')
      .eq('id', sessionUserId)
      .maybeSingle?.() || { data: null }

    isNewProfile = !existingProfile

    const profilePayload: any = {
      id: sessionUserId,
      telegram_id: parseInt(authData.id),
      telegram_username: authData.username,
      email: syntheticEmail,
      first_name: authData.first_name,
      last_name: authData.last_name,
      avatar_url: authData.photo_url,
      preferred_language: 'en',
    }
    if (isNewProfile) profilePayload.points_balance = 1000

    const { error: upsertError } = await (supabaseAdmin as any)
      .from('users')
      .upsert(profilePayload, { onConflict: 'id' })

    if (upsertError) {
      console.error('❌ Failed to upsert user profile (non-fatal):', upsertError)
      // Continue anyway — session is established
    }

    const processingTime = Date.now() - startTime
    console.log('✅ Telegram login successful for user:', sessionUserId.substring(0, 8) + '...', `(${processingTime}ms)`)

    // Create a session bridge token for client-side session establishment
    // This helps ensure the AuthProvider recognizes the session immediately
    const sessionBridgeToken = Buffer.from(JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      user_id: sessionUserId,
      timestamp: Date.now()
    })).toString('base64')

    // Redirect to success page with session bridge token
    const redirectUrl = new URL('/en/profile?auth=telegram_success', request.url)
    redirectUrl.searchParams.set('session_bridge', sessionBridgeToken)
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('❌ Telegram auth error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    })
    return NextResponse.redirect(new URL('/en/auth/login?error=server_error', request.url))
  }
}
