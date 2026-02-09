"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"

interface VideoModelParameterControlsProps {
  videoModels: Model[]
  selectedModel: Model
  onModelChange: (model: Model) => void
  parameters: Record<string, unknown>
  onParametersChange: (params: Record<string, unknown>) => void
  disabled?: boolean
  className?: string
  variant?: "page" | "toolbar"
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
}: VideoModelParameterControlsProps) {
  const isToolbar = variant === "toolbar"

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
      return (
        <Select
          key={param.name}
          value={String(value)}
          onValueChange={(val) => onParametersChange({ ...parameters, [param.name]: val })}
          disabled={disabled}
        >
          <SelectTrigger
            id={param.name}
            size="sm"
            className={cn("h-8 text-xs w-fit min-w-[80px] px-2", isToolbar && "min-w-[70px]")}
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
      return (
        <div
          key={param.name}
          className="h-8 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20"
        >
          <Switch
            id={param.name}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onParametersChange({ ...parameters, [param.name]: checked })}
            className="scale-90"
            disabled={disabled}
          />
          <Label htmlFor={param.name} className="text-xs cursor-pointer whitespace-nowrap leading-none">
            {param.label}
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
            className={cn("h-8 text-xs w-fit min-w-[80px] px-2", isToolbar && "min-w-[70px]")}
          >
            <SelectValue placeholder={param.label}>
              {value != null ? `${value}${unit}` : param.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent side="top">
            {param.enum.map((option) => (
              <SelectItem key={option} value={String(option)} className="text-xs">
                {option}
                {unit}
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
          className="h-8 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20 min-w-[100px]"
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
          className="h-8 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20"
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
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Select
        value={selectedModel.identifier}
        onValueChange={(val) => {
          const model = modelMap.get(val)
          if (model) onModelChange(model)
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className={cn("h-8 text-xs w-fit min-w-[140px]", isToolbar && "min-w-[120px]")}>
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
        selectedModel.parameters.parameters.map((param) => renderParameterInput(param))}
    </div>
  )
}
