import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  console.log('🔄 Auth callback received:', {
    hasCode: !!code,
    error,
    errorDescription,
    next
  })

  // Handle error cases
  if (error) {
    console.error('❌ Auth callback error:', { error, errorDescription })
    
    const errorUrl = new URL('/auth/error', requestUrl.origin)
    errorUrl.searchParams.set('error', error)
    if (errorDescription) {
      errorUrl.searchParams.set('message', errorDescription)
    }
    
    return NextResponse.redirect(errorUrl)
  }

  // Handle missing code
  if (!code) {
    console.error('❌ No auth code provided in callback')
    const errorUrl = new URL('/auth/error', requestUrl.origin)
    errorUrl.searchParams.set('error', 'missing_code')
    errorUrl.searchParams.set('message', 'No authorization code provided')
    return NextResponse.redirect(errorUrl)
  }

  try {
    const supabase = await createClient()
    
    console.log('🔑 Exchanging code for session...')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('❌ Code exchange failed:', exchangeError)
      
      const errorUrl = new URL('/auth/error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('message', exchangeError.message)
      return NextResponse.redirect(errorUrl)
    }

    if (!data.session) {
      console.error('❌ No session returned from code exchange')
      
      const errorUrl = new URL('/auth/error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'no_session')
      errorUrl.searchParams.set('message', 'Failed to establish session')
      return NextResponse.redirect(errorUrl)
    }

    console.log('✅ Session established successfully:', {
      userId: data.session.user.id,
      email: data.session.user.email
    })

    // Determine redirect destination based on the 'next' parameter
    let redirectUrl: string
    
    if (next.includes('reset-password')) {
      // Password reset flow - use the correct locale path
      redirectUrl = new URL('/en/auth/reset-password', requestUrl.origin).toString()
    } else if (next.includes('admin')) {
      // Admin flow
      redirectUrl = new URL('/en/fyponly-admin', requestUrl.origin).toString()
    } else {
      // Default redirect
      redirectUrl = new URL(next, requestUrl.origin).toString()
    }

    console.log('🔄 Redirecting to:', redirectUrl)
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('❌ Unexpected error in auth callback:', error)
    
    const errorUrl = new URL('/auth/error', requestUrl.origin)
    errorUrl.searchParams.set('error', 'unexpected_error')
    errorUrl.searchParams.set('message', 'An unexpected error occurred during authentication')
    return NextResponse.redirect(errorUrl)
  }
}
