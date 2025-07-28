import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  console.log('🔄 Auth callback received:', {
    code: code ? 'present' : 'missing',
    type: type,
    redirectTo: redirectTo,
    allParams: Object.fromEntries(searchParams.entries())
  })

  if (code) {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.redirect(`${origin}/en/auth/login?error=supabase_client_error`)
    }

    try {
      // Handle password recovery differently from regular auth
      if (type === 'recovery') {
        console.log('🔑 Password recovery callback detected, using session-based approach')

        // Try to establish session immediately for both admin and user password resets
        try {
          console.log('🔄 Attempting to exchange code for session in callback...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (!error && data.session) {
            console.log('✅ Session established successfully in callback:', {
              userId: data.session.user.id,
              email: data.session.user.email
            })

            // For admin password reset, redirect with session active
            if (redirectTo.includes('/en/auth/admin-reset-password')) {
              console.log('🔐 Admin password reset detected, redirecting with active session')
              return NextResponse.redirect(`${origin}/en/auth/admin-reset-password?session=active`)
            }

            // Regular user password reset with active session
            console.log('👤 Regular user password reset detected, redirecting with active session')
            return NextResponse.redirect(`${origin}/en/auth/reset-password?session=active`)
          } else {
            console.log('❌ Session exchange failed in callback:', error?.message)

            // Fallback to token-based approach
            if (redirectTo.includes('/en/auth/admin-reset-password')) {
              console.log('🔐 Admin password reset fallback, redirecting with token')
              return NextResponse.redirect(`${origin}/en/auth/admin-reset-password?token=${code}&type=recovery`)
            }

            console.log('👤 Regular user password reset fallback, redirecting with token')
            return NextResponse.redirect(`${origin}/en/auth/reset-password?token=${code}&type=recovery`)
          }
        } catch (sessionError) {
          console.log('❌ Session exchange exception in callback:', sessionError)

          // Fallback to token-based approach
          if (redirectTo.includes('/en/auth/admin-reset-password')) {
            console.log('🔐 Admin password reset exception fallback, redirecting with token')
            return NextResponse.redirect(`${origin}/en/auth/admin-reset-password?token=${code}&type=recovery`)
          }

          console.log('👤 Regular user password reset exception fallback, redirecting with token')
          return NextResponse.redirect(`${origin}/en/auth/reset-password?token=${code}&type=recovery`)
        }
      }

      // For regular authentication (not password recovery), use exchangeCodeForSession
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

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
