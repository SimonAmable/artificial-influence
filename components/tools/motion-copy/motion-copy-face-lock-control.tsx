"use client"

import * as React from "react"
import Image from "next/image"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserFocus } from "@phosphor-icons/react"
import {
  PromptControlMenuContent,
  PromptControlMenuGroup,
  PromptControlMenuItem,
} from "@/components/tools/influencer/prompt-control-menu"
import { influencerControlPillClassName } from "@/components/tools/influencer/animated-control-item"
import {
  faceLockLabel,
  parseFaceLockMode,
  type FaceLockMode,
} from "@/lib/motion-copy/face-lock"
import { cn } from "@/lib/utils"

export interface MotionCopyFaceLockControlProps {
  value: FaceLockMode
  onValueChange: (mode: FaceLockMode) => void
  referenceImageUrl?: string | null
  customFaceImageUrl?: string | null
  characterOrientation?: string | null
  disabled?: boolean
  onRequestCustomPick?: () => void
}

function previewUrl(
  mode: FaceLockMode,
  referenceImageUrl?: string | null,
  customFaceImageUrl?: string | null,
): string | null {
  if (mode === "reference") {
    return typeof referenceImageUrl === "string" && referenceImageUrl.trim().length > 0
      ? referenceImageUrl
      : null
  }
  if (mode === "custom") {
    return typeof customFaceImageUrl === "string" && customFaceImageUrl.trim().length > 0
      ? customFaceImageUrl
      : null
  }
  return null
}

export function MotionCopyFaceLockControl({
  value,
  onValueChange,
  referenceImageUrl,
  customFaceImageUrl,
  characterOrientation,
  disabled = false,
  onRequestCustomPick,
}: MotionCopyFaceLockControlProps) {
  const mode = parseFaceLockMode(value)
  const orientationIsVideo = (characterOrientation ?? "video") === "video"
  const thumbUrl = previewUrl(mode, referenceImageUrl, customFaceImageUrl)
  const controlDisabled = disabled || !orientationIsVideo

  const handleChange = (next: string) => {
    const parsed = parseFaceLockMode(next)
    onValueChange(parsed)
    if (parsed === "custom" && !customFaceImageUrl) {
      onRequestCustomPick?.()
    }
  }

  return (
    <Select value={mode} onValueChange={handleChange} disabled={controlDisabled}>
      <SelectTrigger
        hideChevron={false}
        className={cn(
          influencerControlPillClassName,
          "h-8 gap-1.5 px-2 text-xs font-medium",
          mode !== "off" && "border-primary/40",
        )}
        aria-label="Face lock"
      >
        {thumbUrl ? (
          <span className="relative size-5 shrink-0 overflow-hidden rounded-full border border-border">
            <Image
              src={thumbUrl}
              alt=""
              width={20}
              height={20}
              className="size-full object-cover"
              unoptimized
            />
          </span>
        ) : (
          <UserFocus
            className="size-3.5 shrink-0 text-muted-foreground"
            weight={mode !== "off" ? "fill" : "regular"}
          />
        )}
        <span className="max-w-[5.5rem] truncate">
          {mode === "off" ? "Face lock" : faceLockLabel(mode)}
        </span>
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <PromptControlMenuContent align="start">
        <PromptControlMenuGroup label="Face lock">
          <PromptControlMenuItem
            value="off"
            label="Off"
            description="Standard motion copy"
          />
          <PromptControlMenuItem
            value="reference"
            label="From reference"
            description="Use face from character image"
            disabled={!referenceImageUrl}
          />
          <PromptControlMenuItem
            value="custom"
            label="Custom face…"
            description="Upload or pick a face asset"
          />
        </PromptControlMenuGroup>
      </PromptControlMenuContent>
    </Select>
  )
}
