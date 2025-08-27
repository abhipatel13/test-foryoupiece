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
    sameSite: originalOptions.sameSite || (isProduction ? 'strict' : 'lax'),
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
  // Diagnostic entry log (no sensitive data)
  try {
    console.log('🧪 middleware: handling path', request.nextUrl.pathname)
  } catch {}

  // Handle Supabase auth for all requests first
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Preserve all Supabase-issued cookies (with enhanced security options)
  const pendingCookies: { name: string; value: string; options?: any }[] = []

  // Only handle Supabase auth if environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
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

    // Protected routes that require authentication
    const protectedPaths = ['/en/account', '/en/profile', '/en/checkout', '/en/orders']
    const isProtectedPath = protectedPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    )

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

    // Auth pages that should redirect if already authenticated
    const authPaths = ['/en/auth/login', '/en/auth/register']
    const isAuthPath = authPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    )

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

    // Add security headers to response
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
    supabaseResponse.headers.set('X-Frame-Options', 'DENY')
    supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
    supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Add session validation timestamp for client-side monitoring
    if (user && sessionValidation.valid) {
      supabaseResponse.headers.set('X-Session-Valid', 'true')
      supabaseResponse.headers.set('X-Session-Validated-At', Date.now().toString())
    }
  }

  // Allow root path to be served directly without locale redirect
  if (request.nextUrl.pathname === '/') {
    return supabaseResponse
  }

  // Redirect common shop routes to the correct product catalog
  if (request.nextUrl.pathname === '/shop' || request.nextUrl.pathname === '/shop/') {
    const redirectUrl = new URL('/en/products', request.url)
    const res = NextResponse.redirect(redirectUrl)
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
  const intlResponse = intlMiddleware(request)

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
