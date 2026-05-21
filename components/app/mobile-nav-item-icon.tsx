"use client"

import Image from "next/image"
import { ClockCounterClockwise } from "@phosphor-icons/react"
import {
  ChatCircleDots,
  DownloadSimple,
  FilmStrip,
  FlowArrow,
  Image as ImageIcon,
  MagnifyingGlass,
  Microphone as MicrophoneIcon,
  PaintBrush as PaintBrushIcon,
  Robot as RobotIcon,
  ShieldCheck,
  Video as VideoIcon,
} from "@phosphor-icons/react"

import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import type { MegaNavItem, MegaNavPhosphorIcon } from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

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
  "magnifying-glass": MagnifyingGlass,
  "download-simple": DownloadSimple,
}

export function MobileNavItemIcon({ item, className }: { item: MegaNavItem; className?: string }) {
  const PhosphorIcon = item.iconPhosphor ? MEGA_NAV_PHOSPHOR[item.iconPhosphor] : null

  if (item.path === "/history") {
    return (
      <ClockCounterClockwise
        className={cn("size-4 shrink-0", className)}
        weight="duotone"
        aria-hidden
      />
    )
  }

  if (PhosphorIcon) {
    return <PhosphorIcon className={cn("size-4 shrink-0", className)} weight="duotone" aria-hidden />
  }

  if (item.iconSrc) {
    return (
      <Image
        src={item.iconSrc}
        alt=""
        width={16}
        height={16}
        className={cn(
          "size-4 shrink-0 object-contain",
          isAiMonochromeIconPath(item.iconSrc) && "brightness-0 dark:invert",
          item.path === "/brand" && "invert",
          className,
        )}
      />
    )
  }

  return (
    <span className={cn("text-[10px] font-bold uppercase", className)} aria-hidden>
      {item.iconText ?? item.label.slice(0, 2)}
    </span>
  )
}
