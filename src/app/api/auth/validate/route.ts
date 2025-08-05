import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Session validation API endpoint
 * Validates the current user session and returns user info
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Use getUser() for server-side validation - never trust getSession()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('❌ Session validation failed:', error?.message)
      return NextResponse.json({ 
        valid: false,
        error: error?.message || 'No valid session'
      }, { status: 401 })
    }
    
    console.log('✅ Session validation successful for user:', user.id)
    return NextResponse.json({ 
      valid: true, 
      userId: user.id,
      email: user.email,
      lastSignInAt: user.last_sign_in_at
    })
  } catch (error) {
    console.error('Session validation error:', error)
    return NextResponse.json({ 
      valid: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET method for health check
 */
export async function GET() {
  return NextResponse.json({ 
    message: 'Session validation endpoint is active',
    timestamp: new Date().toISOString()
  })
}
