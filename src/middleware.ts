import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/config'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

/**
 * Enhanced cookie security settings
 */
function getSecureCookieOptions(originalOptions: any = {}) {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    ...originalOptions,
    httpOnly: originalOptions.httpOnly !== false, // Default to httpOnly unless explicitly disabled
    secure: isProduction, // Only secure in production (HTTPS)
    sameSite: originalOptions.sameSite || 'lax', // Use Lax to ensure OAuth/Telegram redirects work reliably
    path: originalOptions.path || '/',
    // Add session timeout for auth cookies
    maxAge: originalOptions.maxAge || (originalOptions.name?.includes('auth') ? 8 * 60 * 60 : undefined) // 8 hours for auth cookies
  }
}

/**
 * Enhanced session validation with proper expiry checks
 */
async function validateSessionSecurity(supabase: any, request: NextRequest) {
  try {
    // Get session data for validation
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { valid: false, reason: 'no_session' }
    }

    // Prefer official expiry from Supabase session (seconds since epoch)
    const nowMs = Date.now()
    const expiresAtMs = typeof session.expires_at === 'number' ? session.expires_at * 1000 : null

    if (expiresAtMs && nowMs >= expiresAtMs) {
      console.warn('🔒 Session expired based on expires_at:', {
        path: request.nextUrl.pathname,
        now: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString()
      })
      return { valid: false, reason: 'session_expired' }
    }

    // Additional security checks for admin paths (fallback to stricter window only if expires_at missing)
    if (request.nextUrl.pathname.includes('admin') || request.nextUrl.pathname.includes('fyponly')) {
      if (!expiresAtMs) {
        // When no explicit expiry is available, enforce a conservative 4h window using last_sign_in_at
        const lastSignIn = (session.user as any)?.last_sign_in_at
        const lastSignInMs = lastSignIn ? new Date(lastSignIn).getTime() : null
        const adminMaxAge = 4 * 60 * 60 * 1000 // 4 hours
        if (!lastSignInMs || (nowMs - lastSignInMs) > adminMaxAge) {
          console.warn('🔒 Admin session failed fallback age check:', {
            path: request.nextUrl.pathname,
            lastSignIn,
            now: new Date(nowMs).toISOString()
          })
          return { valid: false, reason: 'admin_session_expired' }
        }
      }
    }

    return { valid: true, session }
  } catch (error) {
    console.error('❌ Session validation error:', error)
    return { valid: false, reason: 'validation_error' }
  }
}

export default async function middleware(request: NextRequest) {
  // Generate per-request CSP nonce
  const isDev = process.env.NODE_ENV !== 'production'
  const nonce = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString()

  // Build CSP header value (nonce-based, no 'unsafe-inline' or 'unsafe-eval' in prod)
  const cspValue = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' blob: https://accounts.google.com https://apis.google.com https://connect.facebook.net https://static.xx.fbcdn.net https://telegram.org https://vercel.live ${isDev ? "'unsafe-eval'" : ''}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://api.boxhero.io https://accounts.google.com https://oauth2.googleapis.com https://graph.facebook.com https://www.facebook.com https://telegram.org https://oauth.telegram.org https://capig.foryoupiece.com wss://*.supabase.co",
    "frame-src 'self' https://accounts.google.com https://www.facebook.com https://oauth.telegram.org https://telegram.org https://t.me https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.facebook.com",
    "frame-ancestors 'none'",
    "report-uri /api/security/csp-report",
    "upgrade-insecure-requests"
  ].join('; ')

  // Prepare forwarded headers with x-nonce
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-nonce', nonce)

  // Diagnostic entry log (no sensitive data)
  try {
    console.log('🧪 middleware: handling path', request.nextUrl.pathname)
  } catch {}

  // Handle Supabase auth for all requests first
  let supabaseResponse = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  })
  supabaseResponse.headers.set('Content-Security-Policy', cspValue)
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Critical: Prevent caching of authentication API responses across all layers (browser, CDN, proxy)
  try {
    const p = request.nextUrl.pathname
    if (p.startsWith('/api/auth/')) {
      supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
      supabaseResponse.headers.set('Pragma', 'no-cache')
      supabaseResponse.headers.set('Expires', '0')
      supabaseResponse.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
    }
  } catch {}

  // Preserve all Supabase-issued cookies (with enhanced security options)
  const pendingCookies: { name: string; value: string; options?: any }[] = []

  // Only handle Supabase auth if environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Determine whether this path requires session validation (to avoid unnecessary Supabase calls)
  const pathname = request.nextUrl.pathname
  const protectedPaths = ['/en/account', '/en/profile', '/en/checkout', '/en/orders', '/fyponly-admin', '/en/fyponly-admin', '/en/admin']
  const authPaths = ['/en/auth/login', '/en/auth/register']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = authPaths.some(path => pathname.startsWith(path))
  const isApiRoute = pathname.startsWith('/api')
  const shouldValidateSession = !isApiRoute && (isProtectedPath || isAuthPath)

  if (supabaseUrl && supabaseAnonKey && shouldValidateSession) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Debug: log cookie metadata being set by Supabase (no values)
            try {
              console.log(
                '🧪 middleware: Supabase setAll cookies',
                cookiesToSet.map(({ name, options }) => ({
                  name,
                  options: {
                    domain: options?.domain,
                    path: options?.path,
                    httpOnly: options?.httpOnly,
                    sameSite: options?.sameSite,
                    secure: options?.secure,
                    maxAge: options?.maxAge,
                    hasExpires: !!options?.expires
                  }
                }))
              )
            } catch {}

            // Apply enhanced security options to cookies
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                const secureOptions = getSecureCookieOptions({ ...options, name })
                pendingCookies.push({ name, value, options: secureOptions })
              } catch {}
              // Reflect cookie into request for downstream checks
              request.cookies.set(name, value)
            })

            // Create a working response with cookies applied (for early returns)
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              const secureOptions = getSecureCookieOptions({ ...options, name })
              supabaseResponse.cookies.set(name, value, secureOptions)
            })
            try {
              console.log(
                '🧪 middleware: applied Supabase cookies to response with enhanced security',
                cookiesToSet.map(c => c.name)
              )
            } catch {}
          },
        },
      }
    )

    // Enhanced session validation with security checks
    const { data: { user }, error } = await supabase.auth.getUser()
    const sessionValidation = await validateSessionSecurity(supabase, request)

    // Enhanced redirect logic with session validation
    if (isProtectedPath && (error || !user || !sessionValidation.valid)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/en/auth/login'
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)

      // Add session expiration reason for better UX
      if (sessionValidation.reason === 'session_expired') {
        redirectUrl.searchParams.set('reason', 'session_expired')
      }

      try {
        console.log('🧪 middleware: redirecting unauthenticated to login', {
          path: request.nextUrl.pathname,
          reason: sessionValidation.reason || 'no_auth'
        })
      } catch {}

      const res = NextResponse.redirect(redirectUrl)
      try {
        pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      } catch {}
      return res
    }

    // Redirect to home if accessing auth pages while authenticated (with valid session)
    if (isAuthPath && user && !error && sessionValidation.valid) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/en'
      try {
        console.log('🧪 middleware: redirecting authenticated user away from auth page', { path: request.nextUrl.pathname })
      } catch {}
      const res = NextResponse.redirect(redirectUrl)
      try {
        pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      } catch {}
      return res
    }

    // Add session validation timestamp for client-side monitoring
    if (user && sessionValidation.valid) {
      supabaseResponse.headers.set('X-Session-Valid', 'true')
      supabaseResponse.headers.set('X-Session-Validated-At', Date.now().toString())
    }
  } else {
    // Skip Supabase validation for non-protected, non-auth, and API routes to improve performance
    try { supabaseResponse.headers.set('X-Session-Validation', 'skipped') } catch {}
  }


	  // Always set marketing consent cookie (Cambodia policy)
	  try {
	    const isProduction = process.env.NODE_ENV === 'production'
	    const consentOptions = { path: '/', sameSite: 'lax', secure: isProduction, httpOnly: false, maxAge: 31536000 }
	    // Set on primary response
	    supabaseResponse.cookies.set('fyp_consent_marketing', 'true', consentOptions)
	    // Ensure it is merged into any subsequent redirect or intl response
	    pendingCookies.push({ name: 'fyp_consent_marketing', value: 'true', options: consentOptions })
	  } catch {}

  // Allow root path to be served directly without locale redirect
  if (request.nextUrl.pathname === '/') {
    return supabaseResponse
  }

  // Redirect common shop routes to the correct product catalog
  if (request.nextUrl.pathname === '/shop' || request.nextUrl.pathname === '/shop/') {
    const redirectUrl = new URL('/en/products', request.url)
    const res = NextResponse.redirect(redirectUrl)
    // Ensure CSP header and nonce are set on redirects
    res.headers.set('Content-Security-Policy', cspValue)
    try {
      pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
    } catch {}
    return res
  }

  // Exclude API routes from internationalization
  if (request.nextUrl.pathname.startsWith('/api')) {
    return supabaseResponse
  }

  // Exclude /fyponly-admin paths from internationalization (admin routes)
  if (request.nextUrl.pathname.startsWith('/fyponly-admin')) {
    return supabaseResponse
  }

  // Exclude test routes for debugging
  if (request.nextUrl.pathname.startsWith('/test-route')) {
    return supabaseResponse
  }

  // Apply internationalization middleware for all other paths
  // IMPORTANT: Pass the forwardedHeaders (with x-nonce) so Next can attach the nonce
  // to all inline scripts generated for this response.
  const requestWithNonce = new NextRequest(request.url, { headers: forwardedHeaders })
  const intlResponse = intlMiddleware(requestWithNonce)

  // Ensure CSP and core security headers are present on intl response
  intlResponse.headers.set('Content-Security-Policy', cspValue)
  intlResponse.headers.set('X-Content-Type-Options', 'nosniff')
  intlResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
  intlResponse.headers.set('X-XSS-Protection', '1; mode=block')
  intlResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Merge Supabase cookies with intl response (preserve options)
  if (pendingCookies.length > 0) {
    try {
      console.log(
        '🧪 middleware: merging cookies into intl response WITH options',
        pendingCookies.map(c => c.name)
      )
    } catch {}
    pendingCookies.forEach(({ name, value, options }) => {
      intlResponse.cookies.set(name, value, options)
    })
  }

  return intlResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
