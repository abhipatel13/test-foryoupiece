import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/config'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

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
  // Preserve all Supabase-issued cookies (with options) to apply to final responses (incl. redirects)
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
            // Keep original options to apply on the final response (intl or redirects)
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                pendingCookies.push({ name, value, options })
              } catch {}
              // Reflect cookie into request for downstream checks
              request.cookies.set(name, value)
            })
            // Create a working response with cookies applied (for early returns)
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
            try {
              console.log(
                '🧪 middleware: applied Supabase cookies to response with options',
                cookiesToSet.map(c => c.name)
              )
            } catch {}
          },
        },
      }
    )

    // Validate session with getUser() - never trust getSession() on server
    const { data: { user }, error } = await supabase.auth.getUser()

    // Protected routes that require authentication
    const protectedPaths = ['/en/account', '/en/profile', '/en/checkout', '/en/orders']
    const isProtectedPath = protectedPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    )

    // Redirect to login if accessing protected route without valid session
    if (isProtectedPath && (error || !user)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/en/auth/login'
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      try {
        console.log('🧪 middleware: redirecting unauthenticated to login', { path: request.nextUrl.pathname })
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

    // Redirect to home if accessing auth pages while authenticated
    if (isAuthPath && user && !error) {
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
