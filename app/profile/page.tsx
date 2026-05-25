import { redirect } from "next/navigation"

import { CreditsSettingsPanel } from "@/components/profile/credits-settings-panel"
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel"
import { createClient } from "@/lib/supabase/server"
import { getUserSubscription } from "@/lib/subscription-server"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/profile")
  }

  const [{ data: profile }, subscription] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, credits, created_at, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    getUserSubscription(user.id),
  ])

  const displayName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "User"
  const email = profile?.email || user.email || "No email available"
  const credits = typeof profile?.credits === "number" ? profile.credits : 0
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString()
    : "Unknown"
  const hasSubscription = Boolean(subscription)
  const subscriptionStatus = subscription ? subscription.status.replaceAll("_", " ") : "free plan"
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : "Not subscribed"
  const hasCompletedOnboarding = Boolean(profile?.onboarding_completed_at)

  return (
    <main className="min-h-screen bg-background px-4 py-20 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        <section className="p-1">
          <ProfileSettingsPanel
            variant="page"
            displayName={displayName}
            email={email}
            memberSince={memberSince}
            hasCompletedOnboarding={hasCompletedOnboarding}
            userId={user.id}
          />
        </section>
        <section className="p-1">
          <p className="mb-4 text-sm text-muted-foreground">Credits & subscription</p>
          <CreditsSettingsPanel
            variant="page"
            credits={credits}
            subscriptionStatus={subscriptionStatus}
            renewalDate={renewalDate}
            hasSubscription={hasSubscription}
          />
        </section>
      </div>
    </main>
  )
}
