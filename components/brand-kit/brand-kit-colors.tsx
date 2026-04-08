"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { Plus, Trash } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { BrandColorToken } from "@/lib/brand-kit/types"

const MAX_COLORS = 8

function normalizeHex(raw: string): string {
  const s = raw.trim().replace(/^#/, "")
  if (s.length === 6 && /^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toUpperCase()}`
  return raw.startsWith("#") ? raw : `#${raw}`
}

function isValidHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(s))
}

type BrandKitColorsProps = {
  colors: BrandColorToken[]
  onChange: (next: BrandColorToken[]) => void
  className?: string
}

export function BrandKitColors({ colors, onChange, className }: BrandKitColorsProps) {
  const [openIndex, setOpenIndex] = React.useState<number | "add" | null>(null)
  const [draftHex, setDraftHex] = React.useState("#000000")

  const openPicker = (index: number | "add", initialHex: string) => {
    setDraftHex(isValidHex(initialHex) ? normalizeHex(initialHex) : "#000000")
    setOpenIndex(index)
  }

  const applyDraft = () => {
    const hex = normalizeHex(draftHex)
    if (!isValidHex(hex)) return

    if (openIndex === "add") {
      onChange([...colors, { hex, role: "other", label: "" }])
    } else if (typeof openIndex === "number") {
      const next = [...colors]
      const cur = next[openIndex]
      if (cur) next[openIndex] = { ...cur, hex }
      onChange(next)
    }
    setOpenIndex(null)
  }

  const removeAt = (i: number) => {
    onChange(colors.filter((_, j) => j !== i))
  }

  const setHexAt = (i: number, raw: string) => {
    const next = [...colors]
    const cur = next[i]
    if (!cur) return
    next[i] = { ...cur, hex: raw }
    onChange(next)
  }

  const empty = colors.length === 0

  const pickerBody = (
    <div className="space-y-3">
      <div className="w-full [&_.react-colorful]:w-full">
        <HexColorPicker
          color={isValidHex(draftHex) ? normalizeHex(draftHex) : "#000000"}
          onChange={(c) => setDraftHex(c)}
          style={{ width: "100%" }}
        />
      </div>
      <Input
        value={draftHex}
        onChange={(e) => setDraftHex(e.target.value)}
        className="font-mono text-xs uppercase"
        placeholder="#000000"
        spellCheck={false}
      />
      <button
        type="button"
        className="w-full rounded-xl bg-zinc-100 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
        onClick={() => applyDraft()}
      >
        Done
      </button>
    </div>
  )

  return (
    <div className={cn("flex flex-wrap items-end gap-6", className)}>
      {colors.map((c, i) => (
        <div key={`${c.hex}-${i}`} className="relative flex flex-col items-center gap-2">
          <Popover
            open={openIndex === i}
            onOpenChange={(o) => {
              if (o) openPicker(i, c.hex)
              else setOpenIndex(null)
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group relative h-14 w-14 shrink-0 rounded-full border-2 border-white/10 shadow-inner"
                style={{ backgroundColor: safeColorHex(c.hex) }}
                aria-label={`Color ${i + 1}, open picker`}
              />
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(100vw-2rem,260px)] border-zinc-800 bg-zinc-950 p-3 text-zinc-100"
              align="start"
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Pick color
              </p>
              {pickerBody}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1">
            <Input
              value={c.hex}
              onChange={(e) => setHexAt(i, e.target.value)}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (isValidHex(v)) {
                  const next = [...colors]
                  const cur = next[i]
                  if (cur) next[i] = { ...cur, hex: normalizeHex(v) }
                  onChange(next)
                }
              }}
              className={cn(
                "h-8 min-w-28 rounded-full border-zinc-600 bg-zinc-950/90 px-3 text-center font-mono text-xs text-zinc-100",
                !isValidHex(c.hex) && "border-destructive/50"
              )}
            />
            <button
              type="button"
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Remove color"
              onClick={() => removeAt(i)}
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {empty ? (
        <Popover
          open={openIndex === "add"}
          onOpenChange={(o) => {
            if (o) openPicker("add", "#000000")
            else setOpenIndex(null)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-2 outline-none"
              aria-label="Add brand color"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zinc-600 bg-zinc-950/40 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300">
                <Plus className="h-7 w-7" weight="bold" />
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-950/50 px-3 py-1 font-mono text-xs text-zinc-500">
                Color
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(100vw-2rem,260px)] border-zinc-800 bg-zinc-950 p-3 text-zinc-100"
            align="start"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Add color
            </p>
            {pickerBody}
          </PopoverContent>
        </Popover>
      ) : null}

      {!empty && colors.length < MAX_COLORS ? (
        <Popover
          open={openIndex === "add"}
          onOpenChange={(o) => {
            if (o) openPicker("add", "#000000")
            else setOpenIndex(null)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-2 outline-none"
              aria-label="Add another color"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zinc-600 bg-zinc-950/40 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300">
                <Plus className="h-6 w-6" weight="bold" />
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-950/50 px-3 py-1 font-mono text-[10px] text-zinc-500">
                Add
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(100vw-2rem,260px)] border-zinc-800 bg-zinc-950 p-3 text-zinc-100"
            align="start"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Add color
            </p>
            {pickerBody}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

function safeColorHex(hex: string): string {
  const n = normalizeHex(hex)
  return isValidHex(n) ? n : "#000000"
}
