"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface MultiShotItem {
  prompt: string
  duration: number
}

interface MultiShotEditorProps {
  shots: MultiShotItem[]
  onShotsChange: (shots: MultiShotItem[]) => void
  totalDuration: number
  minShots?: number
  maxShots?: number
  minDurationPerShot?: number
  disabled?: boolean
  className?: string
}

export function MultiShotEditor({
  shots,
  onShotsChange,
  totalDuration,
  minShots = 1,
  maxShots = 6,
  minDurationPerShot = 1,
  disabled = false,
  className,
}: MultiShotEditorProps) {
  const sum = shots.reduce((acc, s) => acc + s.duration, 0)
  const isValid = sum === totalDuration && shots.every((s) => s.duration >= minDurationPerShot)
  const canAdd = shots.length < maxShots

  const addShot = () => {
    if (!canAdd) return
    const remainder = totalDuration - sum
    const nextDuration = Math.max(minDurationPerShot, Math.min(5, remainder > 0 ? remainder : minDurationPerShot))
    onShotsChange([...shots, { prompt: "", duration: nextDuration }])
  }

  const removeShot = (index: number) => {
    if (shots.length <= minShots) return
    const next = shots.filter((_, i) => i !== index)
    onShotsChange(next)
  }

  const updateShot = (index: number, field: "prompt" | "duration", value: string | number) => {
    const next = [...shots]
    if (field === "prompt") next[index] = { ...next[index], prompt: String(value) }
    else next[index] = { ...next[index], duration: Number(value) }
    onShotsChange(next)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Multi-shot ({shots.length}/{maxShots}) · Total: {sum}s {totalDuration !== sum && `(target ${totalDuration}s)`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={addShot}
          disabled={disabled || !canAdd}
        >
          <Plus className="size-3.5 mr-1" />
          Add shot
        </Button>
      </div>
      {!isValid && sum !== totalDuration && (
        <p className="text-xs text-destructive">
          Sum of shot durations must equal total duration ({totalDuration}s).
        </p>
      )}
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {shots.map((shot, index) => (
          <div
            key={index}
            className="flex gap-2 items-start rounded-md border border-border bg-muted/20 p-2"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Shot {index + 1}</Label>
              <Input
                placeholder="Describe this shot..."
                value={shot.prompt}
                onChange={(e) => updateShot(index, "prompt", e.target.value)}
                disabled={disabled}
                className="h-8 text-xs"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={minDurationPerShot}
                  max={totalDuration}
                  value={shot.duration}
                  onChange={(e) => updateShot(index, "duration", Number(e.target.value) || minDurationPerShot)}
                  disabled={disabled}
                  className="h-7 w-16 text-xs"
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeShot(index)}
              disabled={disabled || shots.length <= minShots}
              aria-label="Remove shot"
            >
              <Trash className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
