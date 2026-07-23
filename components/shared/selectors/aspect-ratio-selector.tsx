"use client"

import * as React from "react"
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  filterToEssentialAspectRatios,
  groupAspectRatios,
  resolveDisplayAspectRatio,
} from "@/lib/aspect-ratio-groups"
import { Model, parseModelParameters, isStringParameter } from "@/lib/types/models"
import { AnimatedSelectLabel, influencerControlPillClassName } from "@/components/tools/influencer/animated-control-item"
import {
  PromptControlMenuContent,
  PromptControlMenuGroup,
  PromptControlMenuItem,
  PromptControlMenuSeparator,
} from "@/components/tools/influencer/prompt-control-menu"

/** Filled frame preview for a ratio string (used in selects and toolbars). */
export function AspectRatioIcon({ ratio }: { ratio: string }) {
  const getIconDimensions = () => {
    if (ratio === "match_input_image" || ratio === "auto") {
      return { width: 10, height: 10, dashed: true }
    }

    const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
    if (!match) {
      return { width: 10, height: 10, dashed: false }
    }

    const widthRatio = Number(match[1])
    const heightRatio = Number(match[2])
    if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
      return { width: 10, height: 10, dashed: false }
    }

    const maxDimension = 10
    const scale = maxDimension / Math.max(widthRatio, heightRatio)
    return {
      width: Math.max(6, Math.round(widthRatio * scale)),
      height: Math.max(6, Math.round(heightRatio * scale)),
      dashed: false,
    }
  }

  const icon = getIconDimensions()

  return (
    <div className="flex size-4 shrink-0 items-center justify-center">
      <div
        className={cn(
          "rounded-[2px] bg-foreground",
          icon.dashed && "border border-dashed border-foreground bg-transparent",
        )}
        style={{ width: `${icon.width}px`, height: `${icon.height}px` }}
      />
    </div>
  )
}

/** Human-readable label (e.g. match_input_image → Auto). */
export function formatAspectRatioLabel(ratio: string): string {
  switch (ratio) {
    case "match_input_image":
    case "auto":
      return "Auto"
    default:
      return ratio
  }
}

interface AspectRatioSelectorProps {
  model: Model | null
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
  hideChevron?: boolean
}

/**
 * Component for selecting aspect ratio that filters options based on the selected model's supported ratios.
 * Only shows aspect ratios that the specific model supports.
 */
export function AspectRatioSelector({
  model,
  value,
  onValueChange,
  className,
  disabled = false,
  placeholder = "Select aspect ratio",
  hideChevron = false,
}: AspectRatioSelectorProps) {
  const supportedRatios = React.useMemo(() => {
    if (!model) {
      return []
    }

    if (model.aspect_ratios && model.aspect_ratios.length > 0) {
      return model.aspect_ratios
    }

    const parameters = parseModelParameters(model.parameters)
    const aspectRatioParam = parameters.find(
      (param) => (param.name === "aspect_ratio" || param.name === "aspectRatio") && isStringParameter(param)
    )

    if (!aspectRatioParam || !isStringParameter(aspectRatioParam)) {
      return []
    }

    return aspectRatioParam.enum || []
  }, [model])

  const displayableRatios = React.useMemo(
    () => filterToEssentialAspectRatios(supportedRatios),
    [supportedRatios],
  )

  const groupedRatios = React.useMemo(
    () => groupAspectRatios(displayableRatios),
    [displayableRatios],
  )

  const currentValue = React.useMemo(
    () => resolveDisplayAspectRatio(value, displayableRatios),
    [value, displayableRatios],
  )

  const prevDisplayableRatiosRef = React.useRef<string[]>(displayableRatios)
  React.useEffect(() => {
    if (displayableRatios.length > 0 && onValueChange) {
      const ratiosChanged =
        prevDisplayableRatiosRef.current.length !== displayableRatios.length ||
        prevDisplayableRatiosRef.current.some((r, i) => r !== displayableRatios[i])

      if (ratiosChanged || !value || !displayableRatios.includes(value)) {
        const nextValue = resolveDisplayAspectRatio(value, displayableRatios)
        if (nextValue && nextValue !== value) {
          onValueChange(nextValue)
        }
        prevDisplayableRatiosRef.current = displayableRatios
      }
    }
  }, [displayableRatios, value, onValueChange])

  if (!model || displayableRatios.length === 0) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={true}>
        <SelectTrigger hideChevron={hideChevron} className={cn(influencerControlPillClassName, className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <PromptControlMenuContent>
          <PromptControlMenuItem
            value="__disabled__"
            disabled
            label={model ? "No aspect ratios available" : "Select a model first"}
          />
        </PromptControlMenuContent>
      </Select>
    )
  }

  return (
    <Select
      value={currentValue || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger hideChevron={hideChevron} className={cn(influencerControlPillClassName, className)}>
        <SelectValue placeholder={placeholder}>
          {currentValue && (
            <div className="flex items-center gap-1.5">
              <AspectRatioIcon ratio={currentValue} />
              <AnimatedSelectLabel value={formatAspectRatioLabel(currentValue)} />
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <PromptControlMenuContent>
        {groupedRatios.map((group, groupIndex) => (
          <React.Fragment key={group.label}>
            {groupIndex > 0 ? <PromptControlMenuSeparator /> : null}
            <PromptControlMenuGroup label={group.label}>
              {group.ratios.map((ratio) => (
                <PromptControlMenuItem
                  key={ratio}
                  value={ratio}
                  icon={<AspectRatioIcon ratio={ratio} />}
                  label={formatAspectRatioLabel(ratio)}
                />
              ))}
            </PromptControlMenuGroup>
          </React.Fragment>
        ))}
      </PromptControlMenuContent>
    </Select>
  )
}
