import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ONBOARDING_DONE_COOKIE } from '@/lib/onboarding/constants'

function isOnboardingExemptPath(pathname: string) {
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname === '/login') return true
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true
  return false
}

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value)
  }
}

const onboardingCookieOptions = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false,
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  if (user && !isOnboardingExemptPath(pathname)) {
    const cookieUid = request.cookies.get(ONBOARDING_DONE_COOKIE)?.value
    if (cookieUid === user.id) {
      return supabaseResponse
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.onboarding_completed_at) {
      supabaseResponse.cookies.set(
        ONBOARDING_DONE_COOKIE,
        user.id,
        onboardingCookieOptions
      )
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    const redirectResponse = NextResponse.redirect(url)
    copySupabaseCookies(supabaseResponse, redirectResponse)
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
