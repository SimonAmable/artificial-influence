"use client"

import Link from "next/link"
import * as React from "react"
import { Coin } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  updateAutoStripImageMetadata,
  updateDefaultEnhancePrompt,
} from "@/app/profile/actions"
import { EditableDisplayName } from "@/components/profile/editable-display-name"
import { ProfileLogoutButton } from "@/components/profile/profile-logout-button"
import { RestartOnboardingButton } from "@/components/profile/restart-onboarding-button"
import { LayoutModeToggleGroup } from "@/components/settings/layout-mode-toggle-group"
import { ThemeToggleGroup } from "@/components/settings/theme-toggle-group"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { isOnboardingEnabled } from "@/lib/product/onboarding"

export type ProfileSettingsPanelProps = {
  displayName: string
  email: string
  memberSince: string
  hasCompletedOnboarding: boolean
  userId: string
  credits?: number
  autoStripImageMetadata?: boolean
  onAutoStripImageMetadataChange?: (enabled: boolean) => void
  defaultEnhancePrompt?: boolean
  onDefaultEnhancePromptChange?: (enabled: boolean) => void
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
  credits,
  autoStripImageMetadata = false,
  onAutoStripImageMetadataChange,
  defaultEnhancePrompt = false,
  onDefaultEnhancePromptChange,
  variant = "page",
  onDisplayNameChange,
  onLogout,
  layoutMode,
  onLayoutModeChange,
}: ProfileSettingsPanelProps) {
  const isModal = variant === "modal"
  const nameSize = isModal ? "compact" : "page"
  const showLayout = layoutMode !== undefined && onLayoutModeChange !== undefined
  const [stripMetadata, setStripMetadata] = React.useState(autoStripImageMetadata)
  const [stripMetadataPending, startStripMetadataTransition] = React.useTransition()
  const stripMetadataSwitchId = React.useId()
  const [enhanceByDefault, setEnhanceByDefault] = React.useState(defaultEnhancePrompt)
  const [enhanceByDefaultPending, startEnhanceByDefaultTransition] = React.useTransition()
  const enhanceByDefaultSwitchId = React.useId()

  React.useEffect(() => {
    setStripMetadata(autoStripImageMetadata)
  }, [autoStripImageMetadata])

  React.useEffect(() => {
    setEnhanceByDefault(defaultEnhancePrompt)
  }, [defaultEnhancePrompt])

  const stripMetadataDescription = stripMetadata
    ? "On — removes hidden file data and AI watermarks like Synth ID before images are saved to your library."
    : "Off — images save as generated, including hidden file data and AI watermarks like Synth ID."

  const enhanceByDefaultDescription = enhanceByDefault
    ? "On — Enhance Prompt starts enabled on image tools so your ideas get polished before you generate."
    : "Off — you turn on Enhance Prompt only when you want it."

  function handleStripMetadataChange(checked: boolean) {
    const previous = stripMetadata
    setStripMetadata(checked)
    onAutoStripImageMetadataChange?.(checked)

    startStripMetadataTransition(() => {
      void (async () => {
        const result = await updateAutoStripImageMetadata(checked)
        if (!result.ok) {
          setStripMetadata(previous)
          onAutoStripImageMetadataChange?.(previous)
          toast.error(result.error)
        }
      })()
    })
  }

  function handleEnhanceByDefaultChange(checked: boolean) {
    const previous = enhanceByDefault
    setEnhanceByDefault(checked)
    onDefaultEnhancePromptChange?.(checked)

    startEnhanceByDefaultTransition(() => {
      void (async () => {
        const result = await updateDefaultEnhancePrompt(checked)
        if (!result.ok) {
          setEnhanceByDefault(previous)
          onDefaultEnhancePromptChange?.(previous)
          toast.error(result.error)
        }
      })()
    })
  }

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
        {credits !== undefined ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Coin className="h-3 w-3" weight="fill" />
            {credits} credits
          </Badge>
        ) : null}
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
        <div className="space-y-0 border-t border-border/60 pt-4">
          <label
            htmlFor={enhanceByDefaultSwitchId}
            className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">Enhance prompts by default</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {enhanceByDefaultDescription}
              </p>
            </div>
            <Switch
              id={enhanceByDefaultSwitchId}
              checked={enhanceByDefault}
              onCheckedChange={handleEnhanceByDefaultChange}
              disabled={enhanceByDefaultPending}
              aria-label="Enhance prompts by default"
            />
          </label>
          <label
            htmlFor={stripMetadataSwitchId}
            className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">Strip image metadata</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stripMetadataDescription}
              </p>
            </div>
            <Switch
              id={stripMetadataSwitchId}
              checked={stripMetadata}
              onCheckedChange={handleStripMetadataChange}
              disabled={stripMetadataPending}
              aria-label="Strip image metadata"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className={isModal ? "rounded-full" : undefined}>
          <Link href="/assets?tab=history">View history</Link>
        </Button>
        {isOnboardingEnabled() && hasCompletedOnboarding ? (
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
