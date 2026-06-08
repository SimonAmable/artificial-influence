"use client"

import * as React from "react"
import {
  Check,
  Images,
  Sparkle,
  UploadSimple,
  User,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SLIDE_KIND_LABELS } from "@/lib/slideshows/slide-kind"
import type { SlideshowSlideKind } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

const SLIDE_KINDS: SlideshowSlideKind[] = ["ai", "pack", "custom", "character"]

const KIND_ICONS: Record<SlideshowSlideKind, React.ElementType> = {
  ai: Sparkle,
  pack: Images,
  custom: UploadSimple,
  character: User,
}

const KIND_BADGE_CLASS: Record<SlideshowSlideKind, string> = {
  ai: "bg-chart-3/15 text-chart-3",
  pack: "bg-primary/10 text-primary",
  custom: "bg-chart-5/15 text-chart-5",
  character: "bg-chart-1/15 text-chart-1",
}

export function getSlideKindBadgeClass(kind: SlideshowSlideKind) {
  return KIND_BADGE_CLASS[kind]
}

export function SlideTypeIcon({
  kind,
  className,
}: {
  kind: SlideshowSlideKind
  className?: string
}) {
  const Icon = KIND_ICONS[kind]
  return <Icon className={cn("h-4 w-4", className)} weight="duotone" />
}

export function SlideTypePicker({
  value,
  onChange,
  triggerClassName,
  align = "start",
}: {
  value: SlideshowSlideKind
  onChange: (kind: SlideshowSlideKind) => void
  triggerClassName?: string
  align?: "start" | "center" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2 rounded-full", triggerClassName)}
        >
          <span className={cn("inline-flex rounded-md p-1", KIND_BADGE_CLASS[value])}>
            <SlideTypeIcon kind={value} />
          </span>
          {SLIDE_KIND_LABELS[value]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {SLIDE_KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            className="gap-3"
            onClick={() => onChange(kind)}
          >
            <span className={cn("inline-flex rounded-md p-1.5", KIND_BADGE_CLASS[kind])}>
              <SlideTypeIcon kind={kind} />
            </span>
            <span className="flex-1">{SLIDE_KIND_LABELS[kind]}</span>
            {value === kind ? <Check className="h-4 w-4 text-primary" weight="bold" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
