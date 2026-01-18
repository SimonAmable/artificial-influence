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

// Aspect ratio icon component
function AspectRatioIcon({ ratio }: { ratio: string }) {
  const getIconStyle = () => {
    switch (ratio) {
      case "1:1":
        return "w-3 h-3" // Square
      case "9:16":
        return "w-2 h-3" // Vertical (portrait)
      case "16:9":
        return "w-3 h-2" // Horizontal (landscape)
      case "4:3":
        return "w-3 h-2.5" // Slightly horizontal
      case "3:4":
        return "w-2.5 h-3" // Slightly vertical
      case "3:2":
        return "w-3 h-2" // Landscape
      case "2:3":
        return "w-2 h-3" // Portrait
      default:
        return "w-3 h-3"
    }
  }

  return (
    <div
      className={cn(
        "border-2 border-foreground/60 rounded-[2px] shrink-0",
        getIconStyle()
      )}
    />
  )
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
  const supportedRatios = React.useMemo(() => {
    if (!model) {
      return []
    }

    const parameters = parseModelParameters(model.parameters)
    const aspectRatioParam = parameters.find(
      (param) => param.name === "aspect_ratio" && isStringParameter(param)
    )

    if (!aspectRatioParam || !isStringParameter(aspectRatioParam)) {
      return []
    }

    // Filter out non-ratio values like "auto", "match_input_image", etc.
    // Only include values that match the pattern "width:height" (e.g., "16:9", "1:1")
    const ratioPattern = /^\d+:\d+$/
    return (
      aspectRatioParam.enum?.filter((ratio) => ratioPattern.test(ratio)) || []
    )
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
        <SelectTrigger className={cn("h-7 text-xs w-fit min-w-[120px]", className)}>
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
      <SelectTrigger className={cn("h-7 text-xs w-fit min-w-[120px]", className)}>
        <SelectValue placeholder={placeholder}>
          {currentValue && (
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={currentValue} />
              <span>{currentValue}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" side="top" sideOffset={4}>
        {supportedRatios.map((ratio) => (
          <SelectItem key={ratio} value={ratio}>
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={ratio} />
              <span>{ratio}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
