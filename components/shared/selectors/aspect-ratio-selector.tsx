"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Model, parseModelParameters, isStringParameter } from "@/lib/types/models"

/** Small frame preview for a ratio string (used in selects and toolbars). */
export function AspectRatioIcon({ ratio }: { ratio: string }) {
  const getIconDimensions = () => {
    if (ratio === "match_input_image" || ratio === "auto") {
      return { width: 12, height: 12, dashed: true }
    }

    const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
    if (!match) {
      return { width: 12, height: 12, dashed: false }
    }

    const widthRatio = Number(match[1])
    const heightRatio = Number(match[2])
    if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
      return { width: 12, height: 12, dashed: false }
    }

    const maxDimension = 12
    const scale = maxDimension / Math.max(widthRatio, heightRatio)
    return {
      width: Math.max(8, Math.round(widthRatio * scale)),
      height: Math.max(8, Math.round(heightRatio * scale)),
      dashed: false,
    }
  }

  const icon = getIconDimensions()

  return (
    <div
      className={cn(
        "border-3 border-foreground/60 rounded-[2px] shrink-0",
        icon.dashed && "border-dashed"
      )}
      style={{ width: `${icon.width}px`, height: `${icon.height}px` }}
    />
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
}: AspectRatioSelectorProps) {
  // Extract supported aspect ratios from the model
  // Prefer DB column aspect_ratios when available, else fall back to parameters
  const supportedRatios = React.useMemo(() => {
    if (!model) {
      return []
    }

    // Use DB column if available (single source of truth)
    if (model.aspect_ratios && model.aspect_ratios.length > 0) {
      return model.aspect_ratios
    }

    // Fallback: parse from parameters JSON
    const parameters = parseModelParameters(model.parameters)
    const aspectRatioParam = parameters.find(
      (param) => (param.name === "aspect_ratio" || param.name === "aspectRatio") && isStringParameter(param)
    )

    if (!aspectRatioParam || !isStringParameter(aspectRatioParam)) {
      return []
    }

    return aspectRatioParam.enum || []
  }, [model])

  // Filter current value if it's not in supported ratios
  const currentValue = React.useMemo(() => {
    if (value && supportedRatios.includes(value)) {
      return value
    }
    // Return first supported ratio or empty string if none available
    return supportedRatios.length > 0 ? supportedRatios[0] : ""
  }, [value, supportedRatios])

  // Update value if current selection is not supported (only when supported ratios change)
  const prevSupportedRatiosRef = React.useRef<string[]>(supportedRatios)
  React.useEffect(() => {
    // Only update if supported ratios changed (model changed) and we need to adjust the value
    if (supportedRatios.length > 0 && onValueChange) {
      const ratiosChanged = 
        prevSupportedRatiosRef.current.length !== supportedRatios.length ||
        prevSupportedRatiosRef.current.some((r, i) => r !== supportedRatios[i])
      
      if (ratiosChanged) {
        // If current value is not in new supported ratios, or no value is set, use first supported ratio
        if (!value || !supportedRatios.includes(value)) {
          onValueChange(supportedRatios[0])
        }
        prevSupportedRatiosRef.current = supportedRatios
      }
    }
  }, [supportedRatios, value, onValueChange])

  // If no model is selected or model doesn't support aspect ratios, show empty state
  if (!model || supportedRatios.length === 0) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={true}>
        <SelectTrigger className={cn("h-7 text-xs w-fit min-w-0 px-2", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__disabled__" disabled>
            {model ? "No aspect ratios available" : "Select a model first"}
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Select
      value={currentValue || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-7 text-xs w-fit min-w-0 px-2", className)}>
        <SelectValue placeholder={placeholder}>
          {currentValue && (
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={currentValue} />
              <span>{formatAspectRatioLabel(currentValue)}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" side="top" sideOffset={4}>
        {supportedRatios.map((ratio) => (
          <SelectItem key={ratio} value={ratio}>
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={ratio} />
              <span>{formatAspectRatioLabel(ratio)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
