"use client"

import * as React from "react"
import { toast } from "sonner"

import { updateAutoStripImageMetadata } from "@/app/profile/actions"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const ON_DESCRIPTION =
  "On — removes hidden file data and AI watermarks like Synth ID before images are saved to your library."
const OFF_DESCRIPTION =
  "Off — images save as generated, including hidden file data and AI watermarks like Synth ID."

export type AutoStripImageMetadataSwitchProps = {
  enabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  isSignedIn?: boolean
  signInNextPath?: string
  className?: string
  variant?: "settings-row" | "standalone"
}

export function AutoStripImageMetadataSwitch({
  enabled: enabledProp = false,
  onEnabledChange,
  isSignedIn = true,
  signInNextPath = "/free-tools/metadata-remover",
  className,
  variant = "settings-row",
}: AutoStripImageMetadataSwitchProps) {
  const [enabled, setEnabled] = React.useState(enabledProp)
  const [pending, startTransition] = React.useTransition()
  const switchId = React.useId()

  React.useEffect(() => {
    setEnabled(enabledProp)
  }, [enabledProp])

  const description = enabled ? ON_DESCRIPTION : OFF_DESCRIPTION

  function handleChange(checked: boolean) {
    if (!isSignedIn) {
      toast.error("Sign in to change this setting", {
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.href = `/login?next=${encodeURIComponent(signInNextPath)}`
          },
        },
      })
      return
    }

    const previous = enabled
    setEnabled(checked)
    onEnabledChange?.(checked)

    startTransition(() => {
      void (async () => {
        const result = await updateAutoStripImageMetadata(checked)
        if (!result.ok) {
          setEnabled(previous)
          onEnabledChange?.(previous)
          toast.error(result.error)
        }
      })()
    })
  }

  return (
    <label
      htmlFor={switchId}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4",
        variant === "settings-row"
          ? "min-h-[52px] border-b border-border/60 py-3 last:border-b-0"
          : "rounded-lg border bg-muted/20 p-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">Strip image metadata</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={switchId}
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={pending}
        aria-label="Strip image metadata"
      />
    </label>
  )
}
