import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/lib/supabase/database.types'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'



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


    // Fast-path: if a valid session already exists for this Telegram user, skip session creation
    try {
      const { data: currentUserData } = await supabaseSSR.auth.getUser()
      const currentUser = currentUserData?.user
      const tgIdNum = parseInt(authData.id)
      const isSameTelegramUser = !!(
        currentUser?.email === syntheticEmail ||
        (currentUser?.user_metadata && (currentUser.user_metadata as any).telegram_id === tgIdNum)
      )

      if (currentUser && isSameTelegramUser) {
        console.log('⏩ Existing session detected for Telegram user; skipping session creation')
        const redirectUrl = new URL('/en/profile?auth=telegram_success', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (e) {
      console.warn('⚠️ Failed fast-path session check (non-fatal). Proceeding with normal flow.', e)
    }

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

      console.log('🔄 Attempting to create Telegram user with client-side auth approach:', {
        syntheticEmail,
        telegramId: authData.id,
        username: authData.username,
        firstName: authData.first_name,
        lastName: authData.last_name,
        timestamp: new Date().toISOString()
      });

      // SOLUTION: Use client-side auth instead of admin API to avoid trigger conflicts
      // Create a temporary client-side Supabase instance for user creation
      const { createClient } = await import('@supabase/supabase-js');
      const clientSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Generate secure random password for signUp() method
      const securePassword = crypto.randomUUID() + crypto.randomUUID(); // Extra secure

      // Use client-side signUp which should work better with triggers
      const { data: newUser, error: createError } = await clientSupabase.auth.signUp({
        email: syntheticEmail,
        password: securePassword,
        options: {
          data: {
            telegram_id: parseInt(authData.id),
            username: authData.username || null,
            telegram_username: authData.username || null,
            first_name: authData.first_name || null,
            last_name: authData.last_name || null,
            photo_url: authData.photo_url || null,
            auth_provider: 'telegram',
            created_via: 'telegram_login_widget',
          }
        }
      })

      if (createError) {
        const msg = String(createError?.message || createError || '')
        console.error('🚨 DETAILED CreateUser error analysis:', {
          // Basic error info
          message: msg,
          code: createError?.code,
          status: createError?.status,
          name: createError?.name,

          // Full error object for debugging
          fullError: createError,
          errorType: typeof createError,
          errorKeys: Object.keys(createError || {}),

          // Context information
          syntheticEmail,
          telegramId: authData.id,
          telegramIdParsed: parseInt(authData.id),

          // User metadata being sent
          userMetadata: {
            telegram_id: parseInt(authData.id),
            username: authData.username || null,
            telegram_username: authData.username || null,
            first_name: authData.first_name || null,
            last_name: authData.last_name || null,
            photo_url: authData.photo_url || null,
            auth_provider: 'telegram',
            created_via: 'telegram_login_widget',
          },

          // Environment context
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),

          // Check for common error patterns
          isEmailConflict: msg.toLowerCase().includes('email'),
          isConstraintViolation: msg.toLowerCase().includes('constraint') || msg.toLowerCase().includes('unique'),
          isPermissionError: msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('access'),
          isRateLimitError: msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit'),
          isValidationError: msg.toLowerCase().includes('validation') || msg.toLowerCase().includes('invalid'),
        });

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
          // Log detailed error for non-duplicate errors but continue with magic link attempt
          console.error('🚨 NON-DUPLICATE CreateUser error - this needs investigation:', {
            errorMessage: msg,
            errorCode: createError?.code,
            errorStatus: createError?.status,
            errorName: createError?.name,
            syntheticEmail,
            telegramId: authData.id,

            // Check for specific error patterns
            isEmailError: msg.toLowerCase().includes('email'),
            isConstraintError: msg.toLowerCase().includes('constraint') || msg.toLowerCase().includes('unique'),
            isPermissionError: msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('access'),
            isValidationError: msg.toLowerCase().includes('validation') || msg.toLowerCase().includes('invalid'),
            isRateLimitError: msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit'),
            isNetworkError: msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout'),

            fullErrorObject: createError,
            timestamp: new Date().toISOString()
          });

          console.warn('⚠️ Non-duplicate createUser error; attempting magic link anyway:', msg)
        }
      } else if (newUser?.user?.id) {
        console.log('✅ Created new auth user:', newUser.user.id.substring(0, 8) + '...')

        // Auto-confirm email for Telegram OAuth users since they use synthetic emails
        // This is necessary because signUp() creates unconfirmed users by default
        try {
          const { data: confirmData, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
            newUser.user.id,
            { email_confirm: true }
          );

          if (confirmError) {
            console.warn('⚠️ Failed to auto-confirm Telegram user email:', confirmError.message);
          } else {
            console.log('✅ Auto-confirmed email for Telegram user:', newUser.user.id.substring(0, 8) + '...');
          }
        } catch (confirmErr) {
          console.warn('⚠️ Exception during email confirmation:', confirmErr);
        }
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
        console.error('❌ DETAILED magic link generation failure analysis:', {
          // Basic error info
          error: linkError2?.message,
          code: linkError2?.code,
          status: linkError2?.status,
          name: linkError2?.name,

          // Magic link data analysis
          hasEmailOtp: !!linkData2?.properties?.email_otp,
          hasLinkData: !!linkData2,
          hasProperties: !!linkData2?.properties,
          linkDataKeys: linkData2 ? Object.keys(linkData2) : [],
          propertiesKeys: linkData2?.properties ? Object.keys(linkData2.properties) : [],

          // Context
          syntheticEmail,
          telegramId: authData.id,
          retryAttempts: 3,

          // Full error object for debugging
          fullLinkError: linkError2,
          fullLinkData: linkData2,

          // Error pattern analysis
          isDatabaseError: linkError2?.message?.includes('Database') || linkError2?.message?.includes('database'),
          isUserNotFoundError: linkError2?.message?.includes('User not found') || linkError2?.message?.includes('user not found'),
          isPermissionError: linkError2?.message?.includes('permission') || linkError2?.message?.includes('access'),
          isRateLimitError: linkError2?.message?.includes('rate') || linkError2?.message?.includes('limit'),

          timestamp: new Date().toISOString()
        })

        // Try one more time with a different approach - check if user exists first
        try {
          console.log('🔍 Checking if user exists before final magic link attempt:', syntheticEmail);

          const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            filter: `email.eq.${syntheticEmail}`
          })

          console.log('🔍 User existence check result:', {
            hasData: !!existingUser,
            userCount: existingUser?.users?.length || 0,
            listError: listError?.message,
            syntheticEmail
          });

          if (existingUser?.users?.length > 0) {
            console.log('✅ User exists, attempting final magic link generation for:', {
              userId: existingUser.users[0].id,
              email: existingUser.users[0].email,
              createdAt: existingUser.users[0].created_at
            });

            const { data: finalLinkData, error: finalLinkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: syntheticEmail,
            })

            console.log('🔍 Final magic link generation result:', {
              hasLinkData: !!finalLinkData,
              hasProperties: !!finalLinkData?.properties,
              hasEmailOtp: !!finalLinkData?.properties?.email_otp,
              linkError: finalLinkError?.message,
              linkErrorCode: finalLinkError?.code,
              linkErrorStatus: finalLinkError?.status,
              fullLinkError: finalLinkError
            });

            if (!finalLinkError && finalLinkData?.properties?.email_otp) {
              emailOtp = finalLinkData.properties.email_otp
              hashedToken = (finalLinkData as any)?.properties?.token_hash || null
              console.log('✅ Final magic link generation successful')
            } else {
              const detailedError = `Final magic link failed: ${finalLinkError?.message || 'Unknown error'} (Code: ${finalLinkError?.code || 'N/A'})`;
              console.error('🚨 Final magic link generation failed:', detailedError);
              throw new Error(detailedError)
            }
          } else {
            const userNotFoundError = `User not found after creation - listUsers returned ${existingUser?.users?.length || 0} users for email: ${syntheticEmail}`;
            console.error('🚨 User not found after creation:', userNotFoundError);
            throw new Error(userNotFoundError)
          }
        } catch (finalError) {
          console.error('❌ All magic link attempts failed:', finalError)

          // Provide specific error details instead of generic error
          const errorMessage = String(finalError?.message || finalError || 'Unknown error')
          const errorCode = finalError?.code || 'unknown'

          console.error('🚨 FINAL ERROR ANALYSIS:', {
            errorMessage,
            errorCode,
            errorType: typeof finalError,
            errorName: finalError?.name,
            fullError: finalError,
            syntheticEmail,
            telegramId: authData.id,
            timestamp: new Date().toISOString(),

            // Categorize error type for better debugging
            isUserCreationError: errorMessage.includes('Database error saving new user'),
            isMagicLinkError: errorMessage.includes('magic link'),
            isNetworkError: errorMessage.includes('network') || errorMessage.includes('timeout'),
            isPermissionError: errorMessage.includes('permission') || errorMessage.includes('access'),
            isConstraintError: errorMessage.includes('constraint') || errorMessage.includes('unique'),
          });

          // Return specific error with details for debugging
          const errorParam = encodeURIComponent(errorMessage.substring(0, 100)); // Limit length for URL
          const codeParam = encodeURIComponent(errorCode);

          return NextResponse.redirect(
            new URL(`/en/auth/login?error=telegram_auth_failed&message=${errorParam}&code=${codeParam}`, request.url)
          )
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

    // 4) Create profile on first login; on subsequent logins, only update if something changed
    console.time('profile-sync')
    const { data: existingProfile } = await (supabaseAdmin as any)
      .from('users')
      .select('id, telegram_id, telegram_username, email, first_name, last_name, avatar_url, preferred_language')
      .eq('id', sessionUserId)
      .maybeSingle?.() || { data: null }

    const desiredProfile = {
      id: sessionUserId,
      telegram_id: parseInt(authData.id),
      telegram_username: authData.username ?? null,
      email: syntheticEmail,
      first_name: authData.first_name ?? null,
      last_name: authData.last_name ?? null,
      avatar_url: authData.photo_url ?? null,
      preferred_language: 'en' as const,
    }

    if (!existingProfile) {
      // Insert new profile (the DB trigger award_welcome_bonus will add the single welcome transaction)
      const { error: insertError } = await (supabaseAdmin as any)
        .from('users')
        .insert(desiredProfile)

      if (insertError) {
        console.error('❌ Failed to insert user profile (non-fatal):', insertError)
        // Continue anyway — session is established
      }
    } else {
      // Shallow diff to avoid unnecessary writes on every login
      const needsUpdate = (
        existingProfile.telegram_id !== desiredProfile.telegram_id ||
        existingProfile.telegram_username !== desiredProfile.telegram_username ||
        existingProfile.email !== desiredProfile.email ||
        existingProfile.first_name !== desiredProfile.first_name ||
        existingProfile.last_name !== desiredProfile.last_name ||
        existingProfile.avatar_url !== desiredProfile.avatar_url ||
        existingProfile.preferred_language !== desiredProfile.preferred_language
      )

      if (needsUpdate) {
        const { error: updateError } = await (supabaseAdmin as any)
          .from('users')
          .update({
            telegram_id: desiredProfile.telegram_id,
            telegram_username: desiredProfile.telegram_username,
            email: desiredProfile.email,
            first_name: desiredProfile.first_name,
            last_name: desiredProfile.last_name,
            avatar_url: desiredProfile.avatar_url,
            preferred_language: desiredProfile.preferred_language,
          })
          .eq('id', sessionUserId)

        if (updateError) {
          console.error('❌ Failed to update user profile (non-fatal):', updateError)
          // Continue anyway — session is established
        }
      } else {
        console.log('ℹ️ Profile unchanged; skipping update')
      }
    }
    console.timeEnd('profile-sync')

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

    // Redirect back to login with session bridge token for immediate client-side session + hard reload
    const redirectUrl = new URL('/en/auth/login?auth=telegram_success', request.url)
    redirectUrl.searchParams.set('session_bridge', sessionBridgeToken)
    redirectUrl.searchParams.set('r', String(Date.now()))
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
