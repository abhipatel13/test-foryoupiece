import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/config'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  // Handle Supabase auth for all requests first
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session if expired - required for Server Components
    await supabase.auth.getUser()
  }

  // Allow root path to be served directly without locale redirect
  if (request.nextUrl.pathname === '/') {
    return supabaseResponse
  }

  // Redirect common shop routes to the correct product catalog
  if (request.nextUrl.pathname === '/shop' || request.nextUrl.pathname === '/shop/') {
    const redirectUrl = new URL('/en/products', request.url)
    return NextResponse.redirect(redirectUrl)
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

  // Merge Supabase cookies with intl response
  if (supabaseResponse.cookies.getAll().length > 0) {
    supabaseResponse.cookies.getAll().forEach(cookie => {
      intlResponse.cookies.set(cookie.name, cookie.value)
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
