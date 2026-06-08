"use client"

import * as React from "react"
import { CaretDown } from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SLIDESHOW_OVERLAY_STYLE_LABELS } from "@/lib/slideshows/overlay-text-style"
import type { SlideshowBlueprint, SlideshowOverlay } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

const OVERLAY_STYLES = (["minimal", "clean", "caption", "impact"] as const satisfies readonly SlideshowOverlay["style"][])
  .map((value) => ({ value, label: SLIDESHOW_OVERLAY_STYLE_LABELS[value] }))

export function AdvancedTextSettings({
  blueprint,
  onBlueprintChange,
}: {
  blueprint: SlideshowBlueprint
  onBlueprintChange: (blueprint: SlideshowBlueprint) => void
}) {
  const [open, setOpen] = React.useState(false)
  const settings = blueprint.settings
  const hidden = settings.textMode === "off"

  if (hidden) return null

  function updateTextDefaults(patch: Partial<typeof settings.textDefaults>) {
    onBlueprintChange({
      ...blueprint,
      settings: {
        ...settings,
        textDefaults: { ...settings.textDefaults, ...patch },
      },
    })
  }

  return (
    <div className="rounded-2xl bg-muted/15 ring-1 ring-inset ring-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/20"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-sm font-medium text-foreground/90">Advanced text settings</span>
        <CaretDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-5 border-t px-4 py-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Font size</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={settings.textDefaults.fontSize}
              onValueChange={(value) => {
                if (value) updateTextDefaults({ fontSize: value as "normal" | "small" })
              }}
            >
              <ToggleGroupItem value="normal" className="px-4">Normal</ToggleGroupItem>
              <ToggleGroupItem value="small" className="px-4">Small</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Text width</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={settings.textDefaults.textWidth}
              onValueChange={(value) => {
                if (value) updateTextDefaults({ textWidth: value as "wide" | "narrow" })
              }}
            >
              <ToggleGroupItem value="wide" className="px-4">Wide</ToggleGroupItem>
              <ToggleGroupItem value="narrow" className="px-4">Narrow</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Style</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={settings.textDefaults.style}
              onValueChange={(value) => {
                if (value) {
                  updateTextDefaults({
                    style: value as SlideshowBlueprint["settings"]["textDefaults"]["style"],
                  })
                }
              }}
              className="flex flex-wrap"
            >
              {OVERLAY_STYLES.map((style) => (
                <ToggleGroupItem key={style.value} value={style.value} className="px-3 text-xs">
                  {style.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      ) : null}
    </div>
  )
}
