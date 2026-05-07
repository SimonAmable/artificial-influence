"use client"

import * as React from "react"
import { PricingPlansDialog } from "@/components/pricing/pricing-plans-dialog"
import { OPEN_PRICING_PLANS_EVENT } from "@/lib/pricing-upsell"

export function PricingUpsellController() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleOpen = () => {
      setOpen(true)
    }

    window.addEventListener(OPEN_PRICING_PLANS_EVENT, handleOpen)
    return () => {
      window.removeEventListener(OPEN_PRICING_PLANS_EVENT, handleOpen)
    }
  }, [])

  return <PricingPlansDialog open={open} onOpenChange={setOpen} />
}
