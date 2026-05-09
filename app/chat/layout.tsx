import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { getCurrentTermsDocument, setTermsVersionCookie } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

/**
 * Server-side gate for all /chat routes: one DB read verifies onboarding completion.
 * When the profile already reflects current terms, we refresh the cookie so TermsAcceptanceGate
 * and clients stay aligned.
 */
export default async function ChatLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, terms_accepted_at, terms_version")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[chat/layout] profile read failed:", profileError.message)
  } else if (!profile?.onboarding_completed_at) {
    redirect("/onboarding")
  }

  if (!profileError && profile) {
    try {
      const currentTerms = getCurrentTermsDocument()
      const acceptedAt =
        typeof profile.terms_accepted_at === "string" ? profile.terms_accepted_at : null
      const acceptedVersion =
        typeof profile.terms_version === "string" ? profile.terms_version : null
      const needsAcceptance =
        !acceptedAt ||
        !acceptedVersion ||
        acceptedVersion !== currentTerms.version
      if (!needsAcceptance) {
        await setTermsVersionCookie(currentTerms.version)
      }
    } catch (e) {
      console.error("[chat/layout] terms cookie sync failed:", e)
    }
  }

  return children
}
