"use client"

import * as React from "react"

import { ModelIcon } from "@/components/shared/icons/model-icon"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ANGLES_MODEL_IDS,
  type AnglesModelId,
} from "@/lib/angles/constants"
import { useEffectiveImageModels } from "@/lib/image/studio-tools"
import type { Model } from "@/lib/types/models"

type AnglesModelSelectProps = {
  value: AnglesModelId
  onChange: (value: AnglesModelId) => void
  disabled?: boolean
  onModelsChange?: (models: Model[]) => void
}

export function AnglesModelSelect({
  value,
  onChange,
  disabled = false,
  onModelsChange,
}: AnglesModelSelectProps) {
  const { models } = useEffectiveImageModels()
  const angleModels = React.useMemo(() => {
    const byId = new Map(models.map((model) => [model.identifier, model]))
    return ANGLES_MODEL_IDS.map((id) => byId.get(id)).filter(
      (model): model is Model => Boolean(model),
    )
  }, [models])
  const selectedModel = angleModels.find((model) => model.identifier === value) ?? null

  React.useEffect(() => {
    onModelsChange?.(angleModels)
  }, [angleModels, onModelsChange])

  return (
    <Select value={value} onValueChange={(next) => onChange(next as AnglesModelId)}>
      <SelectTrigger
        aria-label="Image model"
        className="h-11 w-full rounded-xl border-border/60 bg-muted/45"
        disabled={disabled || angleModels.length === 0}
      >
        <SelectValue placeholder="Select model">
          {selectedModel ? (
            <span className="flex min-w-0 items-center gap-2">
              <ModelIcon identifier={selectedModel.identifier} size={16} />
              <span className="truncate">{selectedModel.name}</span>
            </span>
          ) : (
            "Loading models…"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {angleModels.map((model) => (
          <SelectItem key={model.identifier} value={model.identifier}>
            <ModelIcon identifier={model.identifier} size={16} />
            <span>{model.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
