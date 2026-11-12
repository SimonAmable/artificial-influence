"use client"

import * as React from "react"
import { Plus, Stack, Trash } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  MAX_WAVESPEED_LORAS,
  WAVESPEED_LORA_SCALE_DEFAULT,
  WAVESPEED_LORA_SCALE_MAX,
  WAVESPEED_LORA_SCALE_MIN,
  countActiveWaveSpeedLoras,
  createEmptyWaveSpeedLoraSlot,
  type WaveSpeedLoraSlot,
} from "@/lib/image/wavespeed-loras"
import { cn } from "@/lib/utils"
import { influencerControlIconButtonClassName } from "./animated-control-item"

export interface QwenLoraControlProps {
  loras: WaveSpeedLoraSlot[]
  onLorasChange: (loras: WaveSpeedLoraSlot[]) => void
  disabled?: boolean
}

export function QwenLoraControl({ loras, onLorasChange, disabled }: QwenLoraControlProps) {
  const [open, setOpen] = React.useState(false)
  const activeCount = countActiveWaveSpeedLoras(loras)

  const ensureEditableSlots = React.useCallback((): WaveSpeedLoraSlot[] => {
    if (loras.length > 0) return loras
    return [createEmptyWaveSpeedLoraSlot()]
  }, [loras])

  React.useEffect(() => {
    if (!open) return
    if (loras.length === 0) {
      onLorasChange([createEmptyWaveSpeedLoraSlot()])
    }
  }, [open, loras.length, onLorasChange])

  const slots = open ? ensureEditableSlots() : loras

  const updateSlot = (id: string, patch: Partial<WaveSpeedLoraSlot>) => {
    onLorasChange(
      ensureEditableSlots().map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    )
  }

  const removeSlot = (id: string) => {
    const next = ensureEditableSlots().filter((slot) => slot.id !== id)
    onLorasChange(next.length > 0 ? next : [createEmptyWaveSpeedLoraSlot()])
  }

  const addSlot = () => {
    const current = ensureEditableSlots()
    if (current.length >= MAX_WAVESPEED_LORAS) return
    onLorasChange([...current, createEmptyWaveSpeedLoraSlot()])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className={cn(influencerControlIconButtonClassName, "relative")}
          aria-label={activeCount > 0 ? `LoRAs (${activeCount})` : "LoRAs"}
        >
          <Stack size={16} weight="bold" />
          {activeCount > 0 ? (
            <Badge
              variant="secondary"
              className="pointer-events-none absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(20rem,calc(100vw-2rem))] p-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium leading-none">LoRAs</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Up to 3 safetensors URLs. Saved on this device.
            </p>
          </div>
          <div className="space-y-2.5">
            {slots.map((slot, index) => (
              <div key={slot.id} className="rounded-lg border border-border/80 bg-muted/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">LoRA {index + 1}</span>
                  {slots.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => removeSlot(slot.id)}
                      aria-label={`Remove LoRA ${index + 1}`}
                    >
                      <Trash size={14} />
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`lora-url-${slot.id}`} className="text-[11px] text-muted-foreground">
                    Weights URL
                  </Label>
                  <Input
                    id={`lora-url-${slot.id}`}
                    value={slot.path}
                    onChange={(event) => updateSlot(slot.id, { path: event.target.value })}
                    placeholder="https://…/model.safetensors"
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`lora-scale-${slot.id}`} className="text-[11px] text-muted-foreground">
                    Scale ({WAVESPEED_LORA_SCALE_MIN}–{WAVESPEED_LORA_SCALE_MAX})
                  </Label>
                  <Input
                    id={`lora-scale-${slot.id}`}
                    type="number"
                    min={WAVESPEED_LORA_SCALE_MIN}
                    max={WAVESPEED_LORA_SCALE_MAX}
                    step={0.1}
                    value={Number.isFinite(slot.scale) ? slot.scale : WAVESPEED_LORA_SCALE_DEFAULT}
                    onChange={(event) => {
                      const parsed = Number(event.target.value)
                      updateSlot(slot.id, {
                        scale: Number.isFinite(parsed) ? parsed : WAVESPEED_LORA_SCALE_DEFAULT,
                      })
                    }}
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>
          {slots.length < MAX_WAVESPEED_LORAS ? (
            <Button type="button" variant="secondary" size="sm" className="h-8 w-full text-xs" onClick={addSlot} disabled={disabled}>
              <Plus size={14} className="mr-1.5" />
              Add LoRA ({slots.length}/{MAX_WAVESPEED_LORAS})
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
