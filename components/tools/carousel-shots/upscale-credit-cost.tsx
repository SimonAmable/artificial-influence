"use client"

import { Sparkle } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

type UpscaleCreditCostProps = {
  cost: number
  className?: string
}

export function UpscaleCreditCost({ cost, className }: UpscaleCreditCostProps) {
  if (!Number.isFinite(cost) || cost <= 0) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums text-[10px] font-semibold opacity-80",
        className,
      )}
    >
      <Sparkle className="size-2.5" weight="fill" aria-hidden />
      {cost}
    </span>
  )
}
