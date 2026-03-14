import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getPostLoginRedirect, resolveUserRole } from './app/lib/user-profile'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxRequests = 100
  const current = rateLimitMap.get(ip)

  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count += 1
  return true
}

async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  type CookieToSet = {
    name: string
    value: string
    options?: Parameters<typeof supabaseResponse.cookies.set>[2]
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const protectedRoutes = ['/checkout', '/payment', '/dashboard', '/transactions', '/reservations']
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && user) {
    const userRole = await resolveUserRole(supabase, user)
    const redirectTo = getPostLoginRedirect(
      userRole,
      request.nextUrl.searchParams.get('redirect')
    )

    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  if (pathname.startsWith('/dashboard') && user) {
    const userRole = await resolveUserRole(supabase, user)

    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export async function proxy(request: NextRequest) {
  if (!rateLimit(request)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
