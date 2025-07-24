import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/config'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  // Allow root path to be served directly without locale redirect
  if (request.nextUrl.pathname === '/') {
    return NextResponse.next()
  }

  // Exclude API routes from internationalization
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Exclude /fyponly-admin paths from internationalization (admin routes)
  if (request.nextUrl.pathname.startsWith('/fyponly-admin')) {
    return NextResponse.next()
  }

  // Exclude test routes for debugging
  if (request.nextUrl.pathname.startsWith('/test-route')) {
    return NextResponse.next()
  }

  // Apply internationalization middleware for all other paths
  return intlMiddleware(request)
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
