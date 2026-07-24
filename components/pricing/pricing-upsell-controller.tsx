"use client"

import * as React from "react"
import { PricingPlansDialog } from "@/components/pricing/pricing-plans-dialog"
import {
  OPEN_PRICING_PLANS_EVENT,
  type OpenPricingPlansModalDetail,
  type PricingPlansModalTab,
} from "@/lib/pricing-upsell"

export function PricingUpsellController() {
  const [open, setOpen] = React.useState(false)
  const [initialTab, setInitialTab] = React.useState<PricingPlansModalTab | undefined>()

  React.useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenPricingPlansModalDetail>).detail
      setInitialTab(detail?.tab)
      setOpen(true)
    }

    window.addEventListener(OPEN_PRICING_PLANS_EVENT, handleOpen)
    return () => {
      window.removeEventListener(OPEN_PRICING_PLANS_EVENT, handleOpen)
    }
  }, [])

  return (
    <PricingPlansDialog
      open={open}
      onOpenChange={setOpen}
      initialTab={initialTab}
    />
  )
}
