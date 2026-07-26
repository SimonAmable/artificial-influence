"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowsClockwise,
  ArrowsDownUp,
  MagnifyingGlass,
} from "@phosphor-icons/react"

import {
  ANGLES_ROTATION_MAX,
  ANGLES_ROTATION_MIN,
  ANGLES_TILT_MAX,
  ANGLES_TILT_MIN,
  ANGLES_ZOOM_MAX,
  ANGLES_ZOOM_MIN,
} from "@/lib/angles/constants"
import type { AngleState } from "@/lib/angles/types"
import { cn } from "@/lib/utils"

type AngleSlidersProps = {
  value: AngleState
  onChange: (value: AngleState) => void
  disabled?: boolean
}

const TICK_COUNT = 9
const FILL_SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.65 }

export function AngleSliders({ value, onChange, disabled = false }: AngleSlidersProps) {
  return (
    <div className="space-y-2">
      <AngleSlider
        label="Rotation"
        icon={<ArrowsClockwise className="size-3.5" weight="bold" />}
        value={value.rotation}
        suffix="°"
        min={ANGLES_ROTATION_MIN}
        max={ANGLES_ROTATION_MAX}
        disabled={disabled}
        onChange={(rotation) => onChange({ ...value, rotation })}
      />
      <AngleSlider
        label="Tilt"
        icon={<ArrowsDownUp className="size-3.5" weight="bold" />}
        value={value.tilt}
        suffix="°"
        min={ANGLES_TILT_MIN}
        max={ANGLES_TILT_MAX}
        disabled={disabled}
        onChange={(tilt) => onChange({ ...value, tilt })}
      />
      <AngleSlider
        label="Zoom"
        icon={<MagnifyingGlass className="size-3.5" weight="bold" />}
        value={value.zoom}
        min={ANGLES_ZOOM_MIN}
        max={ANGLES_ZOOM_MAX}
        disabled={disabled}
        onChange={(zoom) => onChange({ ...value, zoom })}
      />
    </div>
  )
}

function AngleSlider({
  label,
  icon,
  value,
  suffix = "",
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  value: number
  suffix?: string
  min: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const [dragging, setDragging] = React.useState(false)
  const lastHapticValue = React.useRef(value)

  const progress = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const activeTick = Math.round(progress * (TICK_COUNT - 1))
  const display = `${value}${suffix}`

  const fireHaptic = React.useCallback(
    (next: number) => {
      if (prefersReducedMotion) return
      if (next === lastHapticValue.current) return
      lastHapticValue.current = next
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(dragging ? 5 : 3)
      }
    },
    [dragging, prefersReducedMotion],
  )

  return (
    <div
      className={cn(
        "relative h-10 overflow-hidden rounded-xl bg-muted/55 ring-1 ring-border/40 transition-[background-color,ring-color] duration-200",
        dragging && "bg-muted/70 ring-border/55",
        disabled && "opacity-50",
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-foreground/[0.07] dark:bg-foreground/[0.11]"
        initial={false}
        animate={{ width: `${progress * 100}%` }}
        transition={prefersReducedMotion ? { duration: 0 } : FILL_SPRING}
      />

      <div className="pointer-events-none relative z-10 grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-foreground/50">{icon}</span>
          <span className="text-xs font-medium tracking-wide">{label}</span>
        </div>

        <div className="flex h-full items-center justify-between px-1">
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <span
              key={i}
              className={cn(
                "w-px rounded-full bg-foreground/25 transition-[height,opacity,background-color] duration-150",
                i === activeTick ? "h-3.5 bg-foreground/45" : "h-2 opacity-45",
                dragging && i === activeTick && "bg-foreground/60",
              )}
            />
          ))}
        </div>

        <span
          className={cn(
            "min-w-[2.5rem] text-right text-xs font-semibold tabular-nums text-foreground/80 transition-colors",
            dragging && "text-foreground",
          )}
        >
          {display}
        </span>
      </div>

      <SliderPrimitive.Root
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next == null) return
          fireHaptic(next)
          onChange(next)
        }}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        className="absolute inset-0 z-20 flex touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-full w-full grow bg-transparent">
          <SliderPrimitive.Range className="absolute h-full bg-transparent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block h-full w-0.5 rounded-none border-0 bg-transparent opacity-0",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:pointer-events-none",
          )}
        />
      </SliderPrimitive.Root>
    </div>
  )
}
