"use client"

import Image from "next/image"
import { ClockCounterClockwise } from "@phosphor-icons/react"
import {
  ChatCircleDots,
  FilmStrip,
  FlowArrow,
  Image as ImageIcon,
  Microphone as MicrophoneIcon,
  PaintBrush as PaintBrushIcon,
  Robot as RobotIcon,
  ShieldCheck,
  Video as VideoIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import {
  type MegaNavBadge,
  type MegaNavItem,
  type MegaNavPhosphorIcon,
} from "@/lib/constants/navigation"

const MEGA_NAV_PHOSPHOR: Record<MegaNavPhosphorIcon, typeof ImageIcon> = {
  image: ImageIcon,
  video: VideoIcon,
  "paint-brush": PaintBrushIcon,
  "film-strip": FilmStrip,
  "flow-arrow": FlowArrow,
  microphone: MicrophoneIcon,
  "chat-circle-dots": ChatCircleDots,
  robot: RobotIcon,
  "shield-check": ShieldCheck,
}

function getBadgeClasses(badge: MegaNavBadge) {
  switch (badge) {
    case "new":
      return {
        pill: "bg-primary text-primary-foreground",
        ring: "ring-1 ring-primary/70 border-primary/60",
      }
    case "popular":
      return {
        pill: "bg-destructive text-destructive-foreground",
        ring: "ring-1 ring-destructive/70 border-destructive/60",
      }
    case "beta":
      return {
        pill: "bg-amber-500 text-white dark:bg-amber-400 dark:text-black",
        ring: "ring-1 ring-amber-500/70 border-amber-500/60 dark:ring-amber-400/70 dark:border-amber-400/60",
      }
    default: {
      const _exhaustive: never = badge
      return _exhaustive
    }
  }
}

function getBadgeLabel(badge: MegaNavBadge) {
  switch (badge) {
    case "new":
      return "New"
    case "popular":
      return "Top"
    case "beta":
      return "Beta"
    default: {
      const _exhaustive: never = badge
      return _exhaustive
    }
  }
}

export function MenuBadge({ badge }: { badge: MegaNavBadge }) {
  const classes = getBadgeClasses(badge)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide leading-none",
        classes.pill
      )}
    >
      {getBadgeLabel(badge)}
    </span>
  )
}

export function MegaNavItemBody({ item }: { item: MegaNavItem }) {
  const classes = item.badge ? getBadgeClasses(item.badge) : null
  const PhosphorIcon = item.iconPhosphor ? MEGA_NAV_PHOSPHOR[item.iconPhosphor] : null
  return (
    <div className="flex w-full items-start gap-3">
      <div className="relative">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted text-[10px] font-bold text-foreground shadow-sm",
            classes?.ring
          )}
        >
          {item.path === "/history" ? (
            <ClockCounterClockwise className="h-[18px] w-[18px] text-foreground" weight="duotone" />
          ) : PhosphorIcon ? (
            <PhosphorIcon className="h-[18px] w-[18px] text-foreground" weight="duotone" />
          ) : item.iconSrc ? (
            <Image
              src={item.iconSrc}
              alt={`${item.label} icon`}
              width={18}
              height={18}
              className={cn(
                "h-[18px] w-[18px] object-contain",
                isAiMonochromeIconPath(item.iconSrc) && "brightness-0 dark:invert",
                item.path === "/brand" && "invert"
              )}
            />
          ) : (
            item.iconText ?? item.label.slice(0, 2).toUpperCase()
          )}
        </div>
        {item.badge ? (
          <span
            className={cn(
              "absolute left-1/2 -top-1 -translate-x-1/2 inline-flex rounded-full px-1 py-0.5 text-[8px] font-extrabold uppercase leading-none",
              classes?.pill
            )}
          >
            {getBadgeLabel(item.badge)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}
