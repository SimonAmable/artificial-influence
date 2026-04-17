"use client"

import { Instagram } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Animated link between the UniCan mark and the standard Instagram mark (automation / social posting).
 */
export function AutomationLogoConnection({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-[220px] w-full items-center justify-center gap-2 overflow-hidden bg-neutral-950 px-3 py-6 sm:gap-4 sm:px-5",
        "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:20px_20px]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-transparent" aria-hidden />

      <div className="relative z-1 flex shrink-0 flex-col items-center gap-2">
        <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- public app mark */}
          <img src="/logo.svg" alt="" width={48} height={48} className="h-12 w-12" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">UniCan</span>
      </div>

      <div className="relative z-1 min-h-[72px] min-w-0 flex-1">
        <svg
          className="h-full w-full min-w-[80px]"
          viewBox="0 0 220 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Dash period 6+6=12px — must match globals.css automation-dash keyframes offset */}
          <path
            d="M 10 36 L 210 36"
            stroke="rgb(255 255 255)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="6 6"
            strokeOpacity={0.85}
            className="animate-automation-dash"
          />
        </svg>
      </div>

      <div className="relative z-1 flex shrink-0 flex-col items-center gap-2">
        <div
          className="rounded-2xl bg-linear-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] p-3 shadow-lg ring-1 ring-white/25"
          aria-hidden
        >
          <Instagram className="h-12 w-12 text-white" strokeWidth={1.75} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Instagram</span>
      </div>
    </div>
  )
}
