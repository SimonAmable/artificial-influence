import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

/**
 * Server-side gate for all /chat routes: one DB read verifies onboarding completion.
 * Terms version cookies are set from Route Handlers / Server Actions only (auth callback,
 * onboarding completion, POST /api/legal/accept); layouts cannot call cookies().set().
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
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[chat/layout] profile read failed:", profileError.message)
  } else if (!profile?.onboarding_completed_at) {
    redirect("/onboarding")
  }

  return children
}
