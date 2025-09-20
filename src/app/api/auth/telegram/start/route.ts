import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'



/**
 * Telegram Deep-Link Login Nonce Generator
 *
 * This endpoint generates a unique nonce for deep-link based Telegram login.
 * Used as a fallback when the Telegram Login Widget fails due to third-party cookie restrictions.
 *
 * Flow:
 * 1. Frontend requests a nonce
 * 2. User clicks deep-link to Telegram bot with nonce
 * 3. Bot verifies user identity and marks nonce as authenticated
 * 4. Frontend polls for nonce status and completes login
 */

// Stateless nonce storage backed by Supabase (service role)
import { createNonce } from '@/lib/telegram/nonce-store'

export async function POST(request: NextRequest) {
  try {
    // Production-only check
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: false,
        error: 'Deep-link login is production-only'
      }, { status: 403 })
    }

    // Generate secure nonce
    const nonce = randomBytes(16).toString('hex')

    // Store nonce in Supabase (10-min TTL enforced in code)
    await createNonce(nonce)

    // Create deep-link URL
    const deepLinkUrl = `https://t.me/Authenticationfypbot?start=login-${nonce}`

    console.log('✅ Generated login nonce:', nonce.substring(0, 8) + '...')

    return NextResponse.json({
      success: true,
      nonce,
      deepLinkUrl,
      expiresIn: 600 // 10 minutes
    })

  } catch (error) {
    console.error('❌ Error generating login nonce:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate login nonce'
    }, { status: 500 })
  }
}


