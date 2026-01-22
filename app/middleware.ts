import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect certain routes that require authentication.
 * Checks for a 'token' cookie and redirects to /login if not present.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define protected routes that require authentication
  const protectedPaths = [
    '/journal',
    '/entries',
    '/new',
    '/insights',
    '/settings',
  ]

  // Check if the current path is protected
  const isProtectedPath = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  if (isProtectedPath) {
    // Check for authentication token in cookies
    const token = request.cookies.get('token')?.value

    if (!token) {
      // Redirect to login page with return URL
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - static files (/_next/static/*, /_next/image/*, /favicon.ico)
     * - public files (/public/*)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
