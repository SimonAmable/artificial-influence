"use client"

import * as React from "react"
import { Select, SelectTrigger } from "@/components/ui/select"
import { UsersThree } from "@phosphor-icons/react"
import {
  PromptControlMenuContent,
  PromptControlMenuGroup,
  PromptControlMenuItem,
} from "@/components/tools/influencer/prompt-control-menu"
import { influencerControlPillClassName } from "@/components/tools/influencer/animated-control-item"
import {
  motionCopySwapModeLabel,
  parseMotionCopySwapMode,
  type MotionCopySwapMode,
} from "@/lib/motion-copy/swap-mode"
import { cn } from "@/lib/utils"

export interface MotionCopySwapModeControlProps {
  value: MotionCopySwapMode
  onValueChange: (mode: MotionCopySwapMode) => void
  disabled?: boolean
  estimatedSwapCredits?: number | null
}

export function MotionCopySwapModeControl({
  value,
  onValueChange,
  disabled = false,
  estimatedSwapCredits = null,
}: MotionCopySwapModeControlProps) {
  const mode = parseMotionCopySwapMode(value)

  const triggerLabel =
    mode === "off"
      ? "Swap mode"
      : estimatedSwapCredits != null
        ? `${motionCopySwapModeLabel(mode)} · ${estimatedSwapCredits} cr`
        : motionCopySwapModeLabel(mode)

  return (
    <Select
      value={mode}
      onValueChange={(next) => onValueChange(parseMotionCopySwapMode(next))}
      disabled={disabled}
    >
      <SelectTrigger
        hideChevron={false}
        className={cn(
          influencerControlPillClassName,
          "h-8 gap-1.5 px-2 text-xs font-medium",
          mode !== "off" && "border-primary/40",
        )}
        aria-label={`Swap mode: ${motionCopySwapModeLabel(mode)}`}
      >
        <UsersThree
          className="size-3.5 shrink-0 text-muted-foreground"
          weight={mode !== "off" ? "fill" : "regular"}
        />
        <span className="max-w-[7.5rem] truncate">{triggerLabel}</span>
      </SelectTrigger>
      <PromptControlMenuContent align="start">
        <PromptControlMenuGroup label="Swap mode">
          <PromptControlMenuItem value="off" label="Default" />
          <PromptControlMenuItem
            value="character_swap"
            label={
              estimatedSwapCredits != null
                ? `Character swap · ${estimatedSwapCredits} cr`
                : "Character swap"
            }
          />
          <PromptControlMenuItem
            value="face_swap"
            label={
              estimatedSwapCredits != null
                ? `Face swap · ${estimatedSwapCredits} cr`
                : "Face swap"
            }
          />
        </PromptControlMenuGroup>
      </PromptControlMenuContent>
    </Select>
  )
}
