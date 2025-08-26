import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createHash } from 'crypto'

/**
 * Telegram Deep-Link Login Polling Endpoint
 * 
 * This endpoint allows the frontend to poll for nonce verification status.
 * When a nonce is verified by the Telegram bot, this endpoint creates a Supabase session.
 */

// Import nonce store from start endpoint
// Note: In production, this should be a shared Redis store
let nonceStore: Map<string, any>

try {
  // Dynamic import to avoid circular dependency
  const startModule = require('../start/route')
  nonceStore = startModule.nonceStore
} catch (error) {
  console.error('❌ Failed to import nonce store:', error)
  nonceStore = new Map()
}

export async function GET(request: NextRequest) {
  try {
    // Production-only check
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: false,
        error: 'Deep-link login is production-only'
      }, { status: 403 })
    }

    const url = new URL(request.url)
    const nonce = url.searchParams.get('nonce')

    if (!nonce) {
      return NextResponse.json({
        success: false,
        error: 'Missing nonce parameter'
      }, { status: 400 })
    }

    const nonceData = nonceStore.get(nonce)
    
    if (!nonceData) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired nonce'
      }, { status: 404 })
    }

    // Check if nonce has expired (10 minutes)
    const now = Date.now()
    const expiredTime = 10 * 60 * 1000
    
    if (now - nonceData.created > expiredTime) {
      nonceStore.delete(nonce)
      return NextResponse.json({
        success: false,
        error: 'Nonce has expired'
      }, { status: 410 })
    }

    // If not verified yet, return pending status
    if (!nonceData.verified || !nonceData.telegramData) {
      return NextResponse.json({
        success: true,
        status: 'pending',
        expiresAt: nonceData.created + expiredTime
      })
    }

    // Nonce is verified, create Supabase session
    console.log('✅ Nonce verified, creating session for user:', nonceData.telegramData.id)

    const supabaseSSR = await createClient()
    const supabaseAdmin = createServiceRoleClient()
    if (!supabaseSSR || !supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Authentication system error'
      }, { status: 500 })
    }

    const telegramData = nonceData.telegramData
    const syntheticEmail = `tg_${telegramData.id}@telegram.foryoupiece.local`

    // Check if user already exists
    const { data: existingUser } = await supabaseSSR
      .from('users')
      .select('id')
      .eq('telegram_id', telegramData.id)
      .single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      console.log('👤 Existing Telegram user found:', userId.substring(0, 8) + '...')
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          auth_provider: 'telegram',
          created_via: 'telegram_deep_link'
        }
      })

      if (createError || !newUser.user) {
        console.error('❌ Failed to create user:', createError)
        return NextResponse.json({
          success: false,
          error: 'User creation failed'
        }, { status: 500 })
      }

      userId = newUser.user.id
      console.log('✅ New Telegram user created:', userId.substring(0, 8) + '...')

      // Create user profile (do not set points here; DB trigger will award welcome bonus once)
      const { error: profileError } = await supabaseSSR
        .from('users')
        .insert({
          id: userId,
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          email: syntheticEmail,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          preferred_language: 'en'
        })

      if (profileError) {
        console.error('❌ Failed to create user profile:', profileError)
      }
    }

    // Generate magic link for session creation
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail
    })

    if (linkError || !linkData.properties?.email_otp) {
      console.error('❌ Failed to generate magic link:', linkError)
      return NextResponse.json({
        success: false,
        error: 'Session creation failed'
      }, { status: 500 })
    }

    // Verify OTP to create session
    const { data: sessionData, error: sessionError } = await supabaseSSR.auth.verifyOtp({
      type: 'email',
      email: syntheticEmail,
      token: linkData.properties.email_otp
    })

    if (sessionError || !sessionData.session) {
      console.error('❌ Failed to create session:', sessionError)
      return NextResponse.json({
        success: false,
        error: 'Session creation failed'
      }, { status: 500 })
    }

    // Clean up nonce
    nonceStore.delete(nonce)

    console.log('✅ Deep-link Telegram login successful for user:', userId.substring(0, 8) + '...')

    // Return session data
    return NextResponse.json({
      success: true,
      status: 'verified',
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        user: sessionData.session.user
      }
    })

  } catch (error) {
    console.error('❌ Error polling nonce:', error)
    return NextResponse.json({
      success: false,
      error: 'Server error'
    }, { status: 500 })
  }
}
