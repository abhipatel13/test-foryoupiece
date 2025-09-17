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

  // Build safelist and sanitizer early so we can log decisions even if exchange fails
  const allowedOrigins = new Set<string>([
    requestUrl.origin,
    process.env.NEXT_PUBLIC_SITE_URL || '',
    process.env.NEXT_PUBLIC_ALT_SITE_URL || ''
  ].filter(Boolean))

  const sanitizeNext = (raw: string | null): string => {
    const n = (raw ?? '').trim()
    if (!n) return '/'
    // Preserve special flows
    if (n.includes('reset-password')) return '/en/auth/reset-password'
    if (n.includes('admin')) return '/en/fyponly-admin'

    // Relative path (single leading slash, not protocol-relative)
    if (n.startsWith('/') && !n.startsWith('//')) {
      return n
    }

    // Absolute URL: allow only if origin in safelist
    try {
      const u = new URL(n)
      if (allowedOrigins.has(u.origin)) {
        if (u.origin === requestUrl.origin) {
          return (u.pathname || '/') + (u.search || '') + (u.hash || '')
        }
        return u.toString()
      }
    } catch {
      // Malformed URLs fall through to default
    }
    return '/'
  }

  // Log a preview of the sanitized target for observability in all code paths
  const __sanitizedNextPreview = sanitizeNext(next)
  console.log('🛡️ Sanitized next (preview):', { input: next, output: __sanitizedNextPreview })


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

    // Determine redirect destination using validated 'next' parameter to prevent open redirects.
    // Uses the top-level sanitizeNext() defined earlier for consistency.

    const sanitizedNext = sanitizeNext(next)
    const redirectUrl = new URL(sanitizedNext, requestUrl.origin).toString()

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
