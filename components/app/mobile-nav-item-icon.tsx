"use client"

import Image from "next/image"
import {
  ChatCircleDots,
  ClockCounterClockwise,
  DownloadSimple,
  FilmStrip,
  Folder,
  FlowArrow,
  Image as ImageIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  Microphone as MicrophoneIcon,
  PaintBrush as PaintBrushIcon,
  Robot as RobotIcon,
  User as UserIcon,
  ShieldCheck,
  SquaresFour,
  Video as VideoIcon,
} from "@phosphor-icons/react"

import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import type { MegaNavItem, MegaNavPhosphorIcon } from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

const MEGA_NAV_PHOSPHOR: Record<MegaNavPhosphorIcon, typeof ImageIcon> = {
  folder: Folder,
  image: ImageIcon,
  video: VideoIcon,
  "paint-brush": PaintBrushIcon,
  "film-strip": FilmStrip,
  "flow-arrow": FlowArrow,
  microphone: MicrophoneIcon,
  "chat-circle-dots": ChatCircleDots,
  robot: RobotIcon,
  user: UserIcon,
  "paper-plane-tilt": PaperPlaneTilt,
  "shield-check": ShieldCheck,
  "magnifying-glass": MagnifyingGlass,
  "download-simple": DownloadSimple,
  "squares-four": SquaresFour,
  "clock-counter-clockwise": ClockCounterClockwise,
}

export function MobileNavItemIcon({ item, className }: { item: MegaNavItem; className?: string }) {
  const PhosphorIcon = item.iconPhosphor ? MEGA_NAV_PHOSPHOR[item.iconPhosphor] : null

  if (PhosphorIcon) {
    return <PhosphorIcon className={cn("size-4 shrink-0", className)} weight="regular" aria-hidden />
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
