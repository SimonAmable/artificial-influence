"use client"

import * as React from "react"
import Link from "next/link"
import { X } from "@phosphor-icons/react"

const STORAGE_KEY = "promotional-banner-dismissed"

export function PromotionalBanner() {
  const [dismissed, setDismissed] = React.useState(true)

  React.useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== "true") {
      setDismissed(false)
    }
  }, [])

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  if (dismissed) return null

  return (
    <div className="relative flex h-8 max-h-8 shrink-0 items-center justify-center overflow-hidden border-b border-primary-foreground/20 bg-primary px-3">
      <Link
        href="/pricing"
        className="flex max-w-full items-center justify-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap px-6 text-xs font-medium text-primary-foreground sm:gap-2 sm:text-sm"
      >
        <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-semibold text-black sm:text-xs">
          50% OFF
        </span>
        <span className="hidden sm:inline">50% OFF Early Access — Beta Access to New AI Features.</span>
        <span className="sm:hidden">50% OFF Early Access — Beta</span>
      </Link>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Dismiss"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-primary-foreground/70 hover:text-primary-foreground"
      >
        <X className="size-3.5" weight="bold" />
      </button>
    </div>
  )
}
