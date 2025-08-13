import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

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

// In-memory store for nonces (in production, use Redis or similar)
const nonceStore = new Map<string, {
  created: number
  verified: boolean
  telegramData?: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
  }
}>()

// Cleanup expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now()
  const expiredTime = 10 * 60 * 1000 // 10 minutes
  
  for (const [nonce, data] of nonceStore.entries()) {
    if (now - data.created > expiredTime) {
      nonceStore.delete(nonce)
    }
  }
}, 5 * 60 * 1000)

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
    
    // Store nonce with timestamp
    nonceStore.set(nonce, {
      created: Date.now(),
      verified: false
    })

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

// Export the nonce store for use in webhook
export { nonceStore }
