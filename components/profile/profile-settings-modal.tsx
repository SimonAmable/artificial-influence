"use client"

import * as React from "react"
import { ChatCircleDots, User, X } from "@phosphor-icons/react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { FeedbackSettingsPanel } from "@/components/profile/feedback-settings-panel"
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type SettingsTab = "profile" | "feedback"

type ProfileData = {
  displayName: string
  email: string
  credits: number
  subscriptionStatus: string
  renewalDate: string
  memberSince: string
  hasSubscription: boolean
  hasCompletedOnboarding: boolean
  userId: string
}

const TAB_LABELS: Record<SettingsTab, string> = {
  profile: "Profile",
  feedback: "Feedback",
}

export type ProfileSettingsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ProfileSettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted/70" />
      </div>
      <div className="space-y-3 border-t border-border/60 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4 py-2">
            <div className="h-4 w-24 rounded bg-muted/70" />
            <div className="h-4 w-20 rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function fetchProfileData(): Promise<ProfileData | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, credits, created_at, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ||
    user.email?.split("@")[0] ||
    "User"
  const email = profile?.email || user.email || "No email available"
  const credits = typeof profile?.credits === "number" ? profile.credits : 0
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString()
    : "Unknown"
  const hasSubscription = Boolean(subscription)
  const subscriptionStatus = subscription
    ? subscription.status.replaceAll("_", " ")
    : "free plan"
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : "Not subscribed"

  return {
    displayName,
    email,
    credits,
    subscriptionStatus,
    renewalDate,
    memberSince,
    hasSubscription,
    hasCompletedOnboarding: Boolean(profile?.onboarding_completed_at),
    userId: user.id,
  }
}

type NavTabButtonProps = {
  tab: SettingsTab
  activeTab: SettingsTab
  icon: React.ReactNode
  label: string
  onSelect: (tab: SettingsTab) => void
  className?: string
}

function NavTabButton({ tab, activeTab, icon, label, onSelect, className }: NavTabButtonProps) {
  const isActive = tab === activeTab
  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function ProfileSettingsModal({ open, onOpenChange }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profile")
  const [data, setData] = React.useState<ProfileData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchProfileData()
      if (!result) {
        setError("You must be signed in to view your profile.")
        setData(null)
        return
      }
      setData(result)
    } catch {
      setError("Could not load profile. Please try again.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      setActiveTab("profile")
      return
    }
    void load()
  }, [open, load])

  const sectionTitle = TAB_LABELS[activeTab]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "!flex h-[min(640px,90dvh)] max-h-[90dvh] w-[calc(100%-1.5rem)] !max-w-[min(880px,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-background p-0",
          "sm:!max-w-[min(880px,calc(100vw-2rem))] sm:w-[calc(100%-2rem)]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Profile and feedback settings.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Sidebar — large screens only (tablet uses top tabs) */}
          <aside className="hidden w-[148px] shrink-0 flex-col border-r border-border/60 bg-muted/20 px-2 py-2.5 lg:flex">
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-4 size-9 shrink-0 rounded-lg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
            <nav className="flex flex-col gap-0.5">
              <NavTabButton
                tab="profile"
                activeTab={activeTab}
                onSelect={setActiveTab}
                label="Profile"
                icon={<User className="h-4 w-4 shrink-0" weight="regular" />}
              />
              <NavTabButton
                tab="feedback"
                activeTab={activeTab}
                onSelect={setActiveTab}
                label="Feedback"
                icon={<ChatCircleDots className="h-4 w-4 shrink-0" weight="regular" />}
              />
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Phone + tablet: top header and tabs */}
            <div className="shrink-0 border-b border-border/60 lg:hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
                <span className="text-sm font-semibold text-foreground">{sectionTitle}</span>
                <span className="size-9" aria-hidden />
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <NavTabButton
                  tab="profile"
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  label="Profile"
                  icon={<User className="h-4 w-4 shrink-0" weight="regular" />}
                  className="justify-center"
                />
                <NavTabButton
                  tab="feedback"
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  label="Feedback"
                  icon={<ChatCircleDots className="h-4 w-4 shrink-0" weight="regular" />}
                  className="justify-center"
                />
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-5">
              <h2 className="mb-5 hidden text-base font-semibold text-foreground lg:block">
                {sectionTitle}
              </h2>

              {activeTab === "profile" ? (
                <>
                  {loading ? <ProfileSettingsSkeleton /> : null}

                  {!loading && error ? (
                    <div className="space-y-3 text-sm">
                      <p className="text-destructive">{error}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {!loading && !error && data ? (
                    <ProfileSettingsPanel
                      variant="modal"
                      {...data}
                      onDisplayNameChange={(name) =>
                        setData((prev) => (prev ? { ...prev, displayName: name } : prev))
                      }
                    />
                  ) : null}
                </>
              ) : (
                <FeedbackSettingsPanel variant="modal" />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
