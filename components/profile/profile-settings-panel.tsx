"use client"

import Link from "next/link"

import { EditableDisplayName } from "@/components/profile/editable-display-name"
import { RestartOnboardingButton } from "@/components/profile/restart-onboarding-button"
import { SettingsRow, SettingsSection } from "@/components/settings/settings-row"
import { Button } from "@/components/ui/button"
export type ProfileSettingsPanelProps = {
  displayName: string
  email: string
  credits: number
  subscriptionStatus: string
  renewalDate: string
  memberSince: string
  hasSubscription: boolean
  hasCompletedOnboarding: boolean
  userId: string
  variant?: "page" | "modal"
  onDisplayNameChange?: (name: string) => void
}

export function ProfileSettingsPanel({
  displayName,
  email,
  credits,
  subscriptionStatus,
  renewalDate,
  memberSince,
  hasSubscription,
  hasCompletedOnboarding,
  userId,
  variant = "page",
  onDisplayNameChange,
}: ProfileSettingsPanelProps) {
  const isModal = variant === "modal"
  const nameSize = isModal ? "compact" : "page"

  return (
    <div className={isModal ? "w-full min-w-0 space-y-6" : "space-y-6"}>
      <div className="space-y-1">
        {!isModal ? <p className="text-sm text-muted-foreground">Profile</p> : null}
        <EditableDisplayName
          initialName={displayName}
          size={nameSize}
          onNameUpdated={onDisplayNameChange}
        />
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div
        className={
          isModal
            ? "border-t border-border/60 pt-1"
            : "rounded-2xl border border-border/60 bg-background/80 px-4"
        }
      >
        <SettingsSection>
          <SettingsRow label="Credits" value={`${credits}`} />
          <SettingsRow label="Plan" value={subscriptionStatus} />
          <SettingsRow label="Renewal" value={renewalDate} />
          <SettingsRow label="Member since" value={memberSince} />
        </SettingsSection>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {hasSubscription ? (
          <Button asChild className={isModal ? "rounded-full" : undefined}>
            <Link href="/dashboard/subscription">Manage subscription</Link>
          </Button>
        ) : (
          <Button asChild className={isModal ? "rounded-full" : undefined}>
            <Link href="/pricing">Upgrade plan</Link>
          </Button>
        )}
        <Button asChild variant="outline" className={isModal ? "rounded-full" : undefined}>
          <Link href="/history">View history</Link>
        </Button>
        {hasCompletedOnboarding ? (
          <RestartOnboardingButton userId={userId} />
        ) : null}
      </div>
    </div>
  )
}
