import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type CarouselShotsIconProps = {
  className?: string
  size?: number
}

function iconProps({ className, size = 16 }: CarouselShotsIconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("shrink-0 text-current", className),
    "aria-hidden": true as const,
  }
}

/** Contact sheet: one image split into a grid. */
export function CarouselFastModeIcon(props: CarouselShotsIconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="1.5" y="1.5" width="5.25" height="5.25" rx="0.75" fill="currentColor" opacity="0.9" />
      <rect x="9.25" y="1.5" width="5.25" height="5.25" rx="0.75" fill="currentColor" opacity="0.9" />
      <rect x="1.5" y="9.25" width="5.25" height="5.25" rx="0.75" fill="currentColor" opacity="0.9" />
      <rect x="9.25" y="9.25" width="5.25" height="5.25" rx="0.75" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

/** Separate full images, one per shot. */
export function CarouselHdModeIcon(props: CarouselShotsIconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="1.5" y="2" width="3.25" height="12" rx="0.75" fill="currentColor" opacity="0.55" />
      <rect x="6.375" y="2" width="3.25" height="12" rx="0.75" fill="currentColor" opacity="0.8" />
      <rect x="11.25" y="2" width="3.25" height="12" rx="0.75" fill="currentColor" opacity="1" />
    </svg>
  )
}

/** One instruction shared across every shot. */
export function CarouselGeneralScopeIcon(props: CarouselShotsIconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="4.5" y="3" width="7" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 7.75V9.25M5.5 11.75H10.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="4" cy="11.75" r="1" fill="currentColor" />
      <circle cx="8" cy="11.75" r="1" fill="currentColor" />
      <circle cx="12" cy="11.75" r="1" fill="currentColor" />
    </svg>
  )
}

/** Custom variation per shot. */
export function CarouselPerShotScopeIcon(props: CarouselShotsIconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="2" y="2.5" width="12" height="2.75" rx="0.75" fill="currentColor" opacity="0.45" />
      <rect x="2" y="6.625" width="12" height="2.75" rx="0.75" fill="currentColor" opacity="0.7" />
      <rect x="2" y="10.75" width="12" height="2.75" rx="0.75" fill="currentColor" opacity="1" />
    </svg>
  )
}

export function carouselToggleLabel(icon: ReactNode, text: string) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      {icon}
      <span>{text}</span>
    </span>
  )
}
