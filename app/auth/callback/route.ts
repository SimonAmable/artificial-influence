import { createClient } from "@/lib/supabase/server"
import {
  applyTermsVersionCookieToResponse,
  clearTermsVersionCookieOnResponse,
  getCurrentTermsDocument,
} from "@/lib/legal/terms-acceptance"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/"
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/"
  }

  // Handle OAuth errors from the provider
  if (error) {
    console.error("OAuth error:", error, errorDescription)
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || "")}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error("Code exchange error:", exchangeError)
      return NextResponse.redirect(
        `${origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    if (data.session) {
      const userId = data.session.user.id
      const currentTerms = getCurrentTermsDocument()
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at, terms_accepted_at, terms_version")
        .eq("id", userId)
        .maybeSingle()

      const needsOnboarding = !profile?.onboarding_completed_at
      const destination = needsOnboarding ? "/onboarding" : next

      const forwardedHost = request.headers.get("x-forwarded-host") // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development"

      const base =
        isLocalEnv
          ? origin
          : forwardedHost
            ? `https://${forwardedHost}`
            : origin

      const response = NextResponse.redirect(`${base}${destination}`)

      if (!needsOnboarding) {
        response.cookies.set(ONBOARDING_DONE_COOKIE, userId, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: false,
        })

        const acceptedVersion =
          typeof profile?.terms_version === "string" ? profile.terms_version : null
        const acceptedAt =
          typeof profile?.terms_accepted_at === "string" ? profile.terms_accepted_at : null

        if (acceptedAt && acceptedVersion === currentTerms.version) {
          applyTermsVersionCookieToResponse(response, currentTerms.version)
        } else {
          clearTermsVersionCookieOnResponse(response)
        }
      }

      return response
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
