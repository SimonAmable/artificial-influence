"use client"

import Link from "next/link"

import { EditableDisplayName } from "@/components/profile/editable-display-name"
import { ProfileLogoutButton } from "@/components/profile/profile-logout-button"
import { RestartOnboardingButton } from "@/components/profile/restart-onboarding-button"
import { LayoutModeToggleGroup } from "@/components/settings/layout-mode-toggle-group"
import { ThemeToggleGroup } from "@/components/settings/theme-toggle-group"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"
import { Button } from "@/components/ui/button"

export type ProfileSettingsPanelProps = {
  displayName: string
  email: string
  memberSince: string
  hasCompletedOnboarding: boolean
  userId: string
  variant?: "page" | "modal"
  onDisplayNameChange?: (name: string) => void
  onLogout?: () => void
  layoutMode?: LayoutMode
  onLayoutModeChange?: (mode: LayoutMode) => void
}

export function ProfileSettingsPanel({
  displayName,
  email,
  memberSince,
  hasCompletedOnboarding,
  userId,
  variant = "page",
  onDisplayNameChange,
  onLogout,
  layoutMode,
  onLayoutModeChange,
}: ProfileSettingsPanelProps) {
  const isModal = variant === "modal"
  const nameSize = isModal ? "compact" : "page"
  const showLayout = layoutMode !== undefined && onLayoutModeChange !== undefined

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
        {!isModal ? (
          <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
        ) : null}
      </div>

      <div
        className={
          isModal ? "space-y-3 border-t border-border/60 pt-6" : "space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4"
        }
      >
        <div>
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Light, dark, or match your system.
          </p>
        </div>
        <ThemeToggleGroup />
        {showLayout ? (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">Editor layout</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Column stacks panels; row places them side by side.
              </p>
            </div>
            <LayoutModeToggleGroup
              layoutMode={layoutMode}
              onLayoutModeChange={onLayoutModeChange}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className={isModal ? "rounded-full" : undefined}>
          <Link href="/history">View history</Link>
        </Button>
        {hasCompletedOnboarding ? (
          <RestartOnboardingButton userId={userId} />
        ) : null}
        <ProfileLogoutButton
          userId={userId}
          variant={variant}
          onLoggedOut={onLogout}
        />
      </div>
    </div>
  )
}
