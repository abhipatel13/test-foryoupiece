import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  // Supabase recovery links may use token or token_hash; normalize here
  const token = searchParams.get('token') || searchParams.get('token_hash') || code

  // Check for error parameters from Supabase verification
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  console.log('🔄 Auth callback received:', {
    code: code ? 'present' : 'missing',
    type: type,
    redirectTo: redirectTo,
    error: error,
    errorCode: errorCode,
    errorDescription: errorDescription,
    allParams: Object.fromEntries(searchParams.entries())
  })

  // Handle error cases from Supabase verification
  if (error) {
    console.log('❌ Supabase verification error received:', { error, errorCode, errorDescription })

    if (errorCode === 'otp_expired' || error === 'access_denied') {
      console.log('🔑 Password reset token expired, redirecting to forgot password')

      // Determine redirect based on the original redirectTo parameter
      if (redirectTo.includes('/en/auth/admin-reset-password')) {
        return NextResponse.redirect(`${origin}/en/auth/admin-forgot-password?error=expired_link`)
      } else {
        return NextResponse.redirect(`${origin}/en/auth/forgot-password?error=expired_link`)
      }
    }

    // For other errors, redirect to login
    return NextResponse.redirect(`${origin}/en/auth/login?error=auth_error&details=${encodeURIComponent(errorDescription || error)}`)
  }

  if (code || token) {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.redirect(`${origin}/en/auth/login?error=supabase_client_error`)
    }

    try {
      // Handle password recovery: prefer code-exchange when available, fallback to verifyOtp
      if (type === 'recovery') {
        try {
          if (code) {
            console.log('🔑 Recovery flow detected, exchanging code for session...')
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error && data.session) {
              console.log('✅ Recovery session (via code) established:', { userId: data.session.user.id, email: data.session.user.email })
              if (redirectTo.includes('/en/auth/admin-reset-password')) {
                return NextResponse.redirect(`${origin}/en/auth/admin-reset-password`)
              }
              return NextResponse.redirect(`${origin}/en/auth/reset-password`)
            } else {
              console.log('❌ Recovery code exchange failed:', error?.message)
            }
          }

          // Fallback to verifyOtp using token_hash when code is absent
          if (token) {
            console.log('🔄 Attempting to verify OTP (token_hash) for password recovery...')
            const { data, error } = await supabase.auth.verifyOtp({ token_hash: token as string, type: 'recovery' })
            if (!error && data.session) {
              console.log('✅ Recovery session (via token) established:', { userId: data.session.user.id, email: data.session.user.email })
              if (redirectTo.includes('/en/auth/admin-reset-password')) {
                return NextResponse.redirect(`${origin}/en/auth/admin-reset-password`)
              }
              return NextResponse.redirect(`${origin}/en/auth/reset-password`)
            } else {
              console.log('❌ Password recovery verification failed:', error?.message)
            }
          }

          // If both mechanisms fail, route back to the appropriate forgot page
          if (redirectTo.includes('/en/auth/admin-reset-password')) {
            return NextResponse.redirect(`${origin}/en/auth/admin-forgot-password?error=invalid_link`)
          }
          return NextResponse.redirect(`${origin}/en/auth/forgot-password?error=invalid_link`)
        } catch (verifyError) {
          console.log('❌ Password recovery handling exception:', verifyError)
          if (redirectTo.includes('/en/auth/admin-reset-password')) {
            return NextResponse.redirect(`${origin}/en/auth/admin-forgot-password?error=invalid_link`)
          }
          return NextResponse.redirect(`${origin}/en/auth/forgot-password?error=invalid_link`)
        }
      }

      // For regular authentication (not password recovery), use exchangeCodeForSession
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      console.log('✅ Data',data)
      console.log('❌ Error',error)

      if (!error && data.session) {
        console.log('✅ Session exchanged successfully:', {
          userId: data.session.user.id,
          type: type
        })

        // Successful authentication, redirect to the intended page
        const finalRedirectTo = redirectTo.startsWith('/') ? redirectTo : '/'
        return NextResponse.redirect(`${origin}${finalRedirectTo}`)
      } else {
        console.error('❌ Session exchange failed:', error)
        // Redirect to login with error
        return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_error&details=${encodeURIComponent(error?.message || 'Unknown error')}`)
      }
    } catch (err) {
      console.error('❌ Auth callback exception:', err)
      return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_exception&details=${encodeURIComponent(String(err))}`)
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/en/auth/login?error=no_code_provided`)
}
