"use client"

import * as React from "react"
import {
  ChatCircleDots,
  Coin,
  HandCoins,
  User,
  X,
  type Icon,
} from "@phosphor-icons/react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { AffiliateSettingsPanel } from "@/components/profile/affiliate-settings-panel"
import { CreditsSettingsPanel } from "@/components/profile/credits-settings-panel"
import { FeedbackSettingsPanel } from "@/components/profile/feedback-settings-panel"
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"
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

export type SettingsTab = "profile" | "credits" | "affiliate" | "feedback"

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

const SETTINGS_TABS: {
  id: SettingsTab
  label: string
  icon: Icon
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "credits", label: "Credits", icon: Coin },
  { id: "affiliate", label: "Affiliate", icon: HandCoins },
  { id: "feedback", label: "Feedback", icon: ChatCircleDots },
]

const TAB_LABELS = Object.fromEntries(
  SETTINGS_TABS.map((t) => [t.id, t.label])
) as Record<SettingsTab, string>

export type ProfileSettingsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: SettingsTab
  layoutMode?: LayoutMode
  onLayoutModeChange?: (mode: LayoutMode) => void
}

function ProfileSettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted/70" />
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
  icon: Icon
  label: string
  onSelect: (tab: SettingsTab) => void
  className?: string
}

function NavTabButton({
  tab,
  activeTab,
  icon: Icon,
  label,
  onSelect,
  className,
}: NavTabButtonProps) {
  const isActive = tab === activeTab
  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" weight="regular" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}

function SettingsTabNav({
  activeTab,
  onSelect,
  variant,
}: {
  activeTab: SettingsTab
  onSelect: (tab: SettingsTab) => void
  variant: "sidebar" | "scroll"
}) {
  return (
    <nav
      className={cn(
        variant === "sidebar" && "flex flex-col gap-0.5",
        variant === "scroll" &&
          "flex gap-1 overflow-x-auto overscroll-x-contain px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {SETTINGS_TABS.map(({ id, label, icon }) => (
        <NavTabButton
          key={id}
          tab={id}
          activeTab={activeTab}
          onSelect={onSelect}
          icon={icon}
          label={label}
          className={variant === "sidebar" ? "w-full" : undefined}
        />
      ))}
    </nav>
  )
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  initialTab = "profile",
  layoutMode,
  onLayoutModeChange,
}: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab)
  const [data, setData] = React.useState<ProfileData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const closeModal = React.useCallback(() => onOpenChange(false), [onOpenChange])

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
    setActiveTab(initialTab)
    void load()
  }, [open, load, initialTab])

  const sectionTitle = TAB_LABELS[activeTab]
  const needsProfileData = activeTab === "profile" || activeTab === "credits"

  function renderPanel() {
    if (needsProfileData && loading) {
      return <ProfileSettingsSkeleton />
    }

    if (needsProfileData && error) {
      return (
        <div className="space-y-3 text-sm">
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )
    }

    if (needsProfileData && !data) {
      return null
    }

    switch (activeTab) {
      case "profile":
        return data ? (
          <ProfileSettingsPanel
            variant="modal"
            displayName={data.displayName}
            email={data.email}
            memberSince={data.memberSince}
            hasCompletedOnboarding={data.hasCompletedOnboarding}
            userId={data.userId}
            onDisplayNameChange={(name) =>
              setData((prev) => (prev ? { ...prev, displayName: name } : prev))
            }
            onLogout={closeModal}
            layoutMode={layoutMode}
            onLayoutModeChange={onLayoutModeChange}
          />
        ) : null
      case "credits":
        return data ? (
          <CreditsSettingsPanel
            variant="modal"
            credits={data.credits}
            subscriptionStatus={data.subscriptionStatus}
            renewalDate={data.renewalDate}
            hasSubscription={data.hasSubscription}
            onCloseModal={closeModal}
          />
        ) : null
      case "affiliate":
        return <AffiliateSettingsPanel variant="modal" onCloseModal={closeModal} />
      case "feedback":
        return <FeedbackSettingsPanel variant="modal" />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex! h-[min(640px,90dvh)] max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[min(880px,calc(100vw-1.5rem))]! flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-background p-0",
          "sm:w-[calc(100%-2rem)] sm:max-w-[min(880px,calc(100vw-2rem))]!"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Account, credits, affiliate, and preferences.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
            <SettingsTabNav activeTab={activeTab} onSelect={setActiveTab} variant="sidebar" />
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
              <SettingsTabNav activeTab={activeTab} onSelect={setActiveTab} variant="scroll" />
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-5">
              <h2 className="mb-5 hidden text-base font-semibold text-foreground lg:block">
                {sectionTitle}
              </h2>
              {renderPanel()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
