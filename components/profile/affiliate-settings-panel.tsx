"use client"

import * as React from "react"
import Link from "next/link"
import { HandCoins } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type AffiliateSettingsPanelProps = {
  variant?: "page" | "modal"
  onCloseModal?: () => void
}

export function AffiliateSettingsPanel({
  variant = "modal",
  onCloseModal,
}: AffiliateSettingsPanelProps) {
  const isModal = variant === "modal"
  const [isEnrolled, setIsEnrolled] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsEnrolled(false)
        return
      }
      const { data } = await supabase
        .from("affiliates")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      setIsEnrolled(Boolean(data))
    })()
  }, [])

  const ctaLabel =
    isEnrolled === null
      ? "Open affiliate program"
      : isEnrolled
        ? "Open affiliate dashboard"
        : "Start earning"

  return (
    <div className={cn("w-full min-w-0 space-y-6", isModal && "min-w-0")}>
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20 p-5 sm:p-6",
          isModal && "bg-muted/30"
        )}
      >
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HandCoins className="size-5" weight="regular" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Earn 20% for 12 months
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Share your link. Get paid on every qualifying subscription you refer—no cap on
          how many creators you bring in.
        </p>
        <Button asChild className={cn("mt-5", isModal && "rounded-full")}>
          <Link href="/affiliate" onClick={() => onCloseModal?.()}>
            {ctaLabel}
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Commission applies to qualifying paid conversions for up to twelve months per
        referral. See program terms on the affiliate page.
      </p>
    </div>
  )
}
