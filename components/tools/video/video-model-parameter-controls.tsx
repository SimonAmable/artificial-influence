"use client"

import * as React from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import {
  AspectRatioIcon,
  formatAspectRatioLabel,
} from "@/components/shared/selectors/aspect-ratio-selector"
import { SpeakerHigh } from "@phosphor-icons/react"

/** -1 = model-chosen length; show "Auto" instead of "-1s" in the UI. */
function formatDurationEnumLabel(option: number, unit: string): string {
  if (unit === "s" && option === -1) return "Auto"
  return `${option}${unit}`
}

interface VideoModelParameterControlsProps {
  videoModels: Model[]
  selectedModel: Model
  onModelChange: (model: Model) => void
  parameters: Record<string, unknown>
  onParametersChange: (params: Record<string, unknown>) => void
  disabled?: boolean
  className?: string
  variant?: "page" | "toolbar" | "image"
  /** When true, show "Keep original sound" (e.g. Omni with reference video) */
  referenceVideoProvided?: boolean
}

export function VideoModelParameterControls({
  videoModels,
  selectedModel,
  onModelChange,
  parameters,
  onParametersChange,
  disabled = false,
  className,
  variant = "page",
  referenceVideoProvided = false,
}: VideoModelParameterControlsProps) {
  const isToolbar = variant === "toolbar"
  const isImage = variant === "image"
  const rowH = isImage ? "!h-7" : "h-8"

  const modelMap = React.useMemo(() => {
    const map = new Map<string, Model>()
    videoModels.forEach((m) => {
      const model: Model = {
        ...m,
        parameters: {
          parameters: buildVideoModelParameters(m),
        },
      }
      map.set(m.identifier, model)
    })
    return map
  }, [videoModels])

  const formatModelName = (identifier: string, name: string): string => {
    if (name && !name.includes("/")) {
      return name
    }
    const parts = identifier.split("/")
    const shortIdentifier = parts[parts.length - 1]
    return shortIdentifier
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const renderParameterInput = (param: ParameterDefinition) => {
    const value = parameters[param.name]

    if (param.ui_type === "select" && "enum" in param && param.enum) {
      // Video reference type (Omni): title + descriptive options
      if (param.name === "video_reference_type") {
        return (
          <Select
            key={param.name}
            value={String(value ?? param.default)}
            onValueChange={(val) => onParametersChange({ ...parameters, [param.name]: val })}
            disabled={disabled}
          >
            <SelectTrigger
              id={param.name}
              size="sm"
              className={cn(rowH, "text-xs w-fit min-w-[80px] px-2", isToolbar && "min-w-[70px]")}
            >
              <SelectValue placeholder={param.label} />
            </SelectTrigger>
            <SelectContent side="top" className="w-[220px] p-1.5">
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-foreground px-2 py-1.5 leading-snug">
                  Reference video use
                  <span className="block font-normal text-muted-foreground mt-0.5">
                    Feature = style/camera for new video
                    <br />
                    Base = edit this video
                  </span>
                </SelectLabel>
                <SelectSeparator className="my-1" />
                <SelectItem value="feature" className="text-sm py-2">
                  Feature
                </SelectItem>
                <SelectItem value="base" className="text-sm py-2">
                  Base
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      }

      const isAspectRatioParam =
        param.name === "aspect_ratio" || param.name === "aspectRatio"
      if (isAspectRatioParam) {
        const aspectVal = String(value ?? param.default ?? param.enum[0])
        return (
          <Select
            key={param.name}
            value={aspectVal}
            onValueChange={(val) => onParametersChange({ ...parameters, [param.name]: val })}
            disabled={disabled}
          >
            <SelectTrigger
              id={param.name}
              size="sm"
              className={cn(rowH, "text-xs w-fit min-w-[80px] px-2", isToolbar && "min-w-[70px]")}
            >
              <SelectValue placeholder={param.label}>
                {aspectVal ? (
                  <div className="flex items-center gap-2">
                    <AspectRatioIcon ratio={aspectVal} />
                    <span>{formatAspectRatioLabel(aspectVal)}</span>
                  </div>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="top">
              {param.enum.map((option) => {
                const opt = String(option)
                return (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    <div className="flex items-center gap-2">
                      <AspectRatioIcon ratio={opt} />
                      <span>{formatAspectRatioLabel(opt)}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )
      }

      return (
        <Select
          key={param.name}
          value={String(value ?? param.default)}
          onValueChange={(val) => onParametersChange({ ...parameters, [param.name]: val })}
          disabled={disabled}
        >
          <SelectTrigger
            id={param.name}
            size="sm"
            className={cn(rowH, "text-xs w-fit min-w-[80px] px-2", isToolbar && "min-w-[70px]")}
          >
            <SelectValue placeholder={param.label} />
          </SelectTrigger>
          <SelectContent side="top">
            {param.enum.map((option) => (
              <SelectItem key={String(option)} value={String(option)} className="text-xs">
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (param.ui_type === "switch" && param.type === "boolean") {
      // Keep original sound: hide for motion control (we always keep). Show for Omni when reference video provided.
      const isMotionControl =
        selectedModel.identifier === "kwaivgi/kling-v2.6-motion-control" ||
        selectedModel.identifier === "kwaivgi/kling-v3-motion-control"
      if (param.name === "keep_original_sound" && (isMotionControl || !referenceVideoProvided)) return null
      const isAudioToggle = param.name === "generate_audio"
      return (
        <div
          key={param.name}
          className={cn(rowH, "flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20")}
        >
          <Switch
            id={param.name}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onParametersChange({ ...parameters, [param.name]: checked })}
            className="scale-90"
            disabled={disabled}
          />
          {isAudioToggle ? (
            <SpeakerHigh className="size-3.5 shrink-0 text-muted-foreground" weight="duotone" />
          ) : null}
          <Label htmlFor={param.name} className="text-xs cursor-pointer whitespace-nowrap leading-none">
            {isAudioToggle ? "Audio" : param.label}
          </Label>
        </div>
      )
    }

    // Number param with enum (e.g. duration_options from DB) → render as select
    if (
      param.type === "number" &&
      "enum" in param &&
      Array.isArray(param.enum) &&
      param.enum.length > 0
    ) {
      const unit = param.name.includes("duration") ? "s" : ""
      const compactDurationToolbar = isToolbar && param.name.includes("duration")
      return (
        <Select
          key={param.name}
          value={String(value ?? param.default)}
          onValueChange={(val) =>
            onParametersChange({ ...parameters, [param.name]: Number(val) })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id={param.name}
            size="sm"
            className={cn(
              rowH,
              "text-xs w-fit px-2",
              compactDurationToolbar
                ? "min-w-fit shrink-0 gap-1 px-1.5 tabular-nums [&_svg:not([class*='size-'])]:size-3.5"
                : "min-w-[80px]",
              isToolbar && !compactDurationToolbar && "min-w-[70px]"
            )}
          >
            <SelectValue placeholder={param.label}>
              {value != null
                ? formatDurationEnumLabel(Number(value), unit)
                : param.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent side="top">
            {param.enum.map((option) => (
              <SelectItem key={option} value={String(option)} className="text-xs">
                {formatDurationEnumLabel(option, unit)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (param.ui_type === "slider" && param.type === "number") {
      const unit = param.name.includes("duration") ? "s" : ""
      return (
        <div
          key={param.name}
          className={cn(rowH, "flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20 min-w-[100px]")}
        >
          <Slider
            id={param.name}
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={[Number(value)]}
            onValueChange={(vals) => onParametersChange({ ...parameters, [param.name]: vals[0] })}
            className="flex-1"
            disabled={disabled}
          />
          <span className="text-xs font-medium text-foreground tabular-nums">
            {String(value)}
            {unit}
          </span>
        </div>
      )
    }

    if (param.ui_type === "number" && param.type === "number") {
      const unit = param.name.includes("duration") ? "s" : ""
      return (
        <div
          key={param.name}
          className={cn(rowH, "flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20")}
        >
          <Input
            id={param.name}
            type="number"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={Number(value)}
            onChange={(e) => onParametersChange({ ...parameters, [param.name]: Number(e.target.value) })}
            className="h-5 text-xs w-12 px-1 border-0 bg-transparent"
            disabled={disabled}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      )
    }

    return null
  }

  return (
    <div className={cn("flex flex-wrap items-center", isImage ? "gap-1" : "gap-1.5", className)}>
      <Select
        value={selectedModel.identifier}
        onValueChange={(val) => {
          const model = modelMap.get(val)
          if (model) onModelChange(model)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          className={cn(rowH, "text-xs w-fit min-w-[140px]", isToolbar && "min-w-[120px]", isImage && "min-w-0")}
        >
          <SelectValue placeholder="Select model">
            {selectedModel && (
              <div className="flex items-center gap-2">
                <ModelIcon identifier={selectedModel.identifier} size={16} />
                <span>{formatModelName(selectedModel.identifier, selectedModel.name)}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" side="top" sideOffset={4}>
          {Array.from(modelMap.values()).map((model) => (
            <SelectItem key={model.identifier} value={model.identifier}>
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-border bg-muted/30 p-1.5 shrink-0">
                  <ModelIcon identifier={model.identifier} size={20} />
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-semibold text-sm">
                    {formatModelName(model.identifier, model.name)}
                  </span>
                  {model.description && (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {model.description}
                    </span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedModel.parameters.parameters &&
        selectedModel.parameters.parameters
          .filter((param) => {
            // Kling v3 / Omni: multi_prompt has its own MultiShotEditor in the input box
            if ((selectedModel.identifier === 'kwaivgi/kling-v3-video' || selectedModel.identifier === 'kwaivgi/kling-v3-omni-video') && param.name === 'multi_prompt') return false
            return true
          })
          .map((param) => renderParameterInput(param))
          .filter(Boolean)}
    </div>
  )
}
