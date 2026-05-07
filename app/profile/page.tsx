import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserSubscription } from "@/lib/subscription-server"

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

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
      .select("full_name, email, credits, created_at")
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

  return (
    <main className="min-h-screen bg-background px-4 py-20 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <section className="p-1">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Profile</p>
            <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-background/80 px-4">
            <InfoRow label="Credits" value={`${credits}`} />
            <InfoRow label="Plan" value={subscriptionStatus} />
            <InfoRow label="Renewal" value={renewalDate} />
            <InfoRow label="Member since" value={memberSince} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {hasSubscription ? (
              <Button asChild>
                <Link href="/dashboard/subscription">Manage subscription</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/pricing">Upgrade plan</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/history">View history</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
