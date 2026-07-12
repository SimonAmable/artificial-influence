"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { SettingsRow, SettingsSection } from "@/components/settings/settings-row"
import { Button } from "@/components/ui/button"
import { openPricingPlansModal } from "@/lib/pricing-upsell"
import { cn } from "@/lib/utils"

export type CreditsSettingsPanelProps = {
  credits: number
  subscriptionStatus: string
  renewalDate: string
  hasSubscription: boolean
  variant?: "page" | "modal"
  onCloseModal?: () => void
}

export function CreditsSettingsPanel({
  credits,
  subscriptionStatus,
  renewalDate,
  hasSubscription,
  variant = "modal",
  onCloseModal,
}: CreditsSettingsPanelProps) {
  const isModal = variant === "modal"
  const [portalLoading, setPortalLoading] = React.useState(false)

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: typeof window !== "undefined" ? window.location.href : "/",
        }),
      })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal.")
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("[credits-settings] portal", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to open billing portal."
      )
    } finally {
      setPortalLoading(false)
    }
  }

  const handleUpgrade = () => {
    onCloseModal?.()
    openPricingPlansModal()
  }

  const pillBtn = isModal ? "rounded-full" : undefined

  return (
    <div className={cn("w-full min-w-0 space-y-6", isModal && "min-w-0")}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Available balance</p>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {credits}
          <span className="ml-2 text-base font-normal text-muted-foreground">credits</span>
        </p>
      </div>

      <div className={isModal ? "border-t border-border/60 pt-1" : "rounded-2xl border border-border/60 bg-background/80 px-4"}>
        <SettingsSection>
          <SettingsRow label="Plan" value={subscriptionStatus} />
          <SettingsRow label="Renewal" value={renewalDate} />
        </SettingsSection>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {hasSubscription ? (
          <Button
            type="button"
            disabled={portalLoading}
            className={pillBtn}
            onClick={() => void handleManageBilling()}
          >
            {portalLoading ? "Opening…" : "Manage billing"}
          </Button>
        ) : (
          <Button type="button" className={pillBtn} onClick={handleUpgrade}>
            Upgrade plan
          </Button>
        )}
        <Button asChild variant="outline" className={pillBtn}>
          <Link href="/pricing" onClick={() => onCloseModal?.()}>
            View all plans
          </Link>
        </Button>
        <Button asChild variant="outline" className={pillBtn}>
          <Link href="/dashboard/subscription" onClick={() => onCloseModal?.()}>
            Subscription details
          </Link>
        </Button>
      </div>
    </div>
  )
}
