"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  SlideshowAspectRatio,
  SlideshowBlueprint,
  SlideshowTextMode,
} from "@/lib/slideshows/types"

const TEXT_MODE_LABELS: Record<SlideshowTextMode, string> = {
  off: "Off",
  overlay: "On",
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
]

export function TemplateToolbar({
  aspectRatio,
  onAspectRatioChange,
  blueprint,
  onBlueprintChange,
}: {
  aspectRatio: SlideshowAspectRatio
  onAspectRatioChange: (ratio: SlideshowAspectRatio) => void
  blueprint: SlideshowBlueprint
  onBlueprintChange: (blueprint: SlideshowBlueprint) => void
}) {
  const settings = blueprint.settings

  function updateSettings(patch: Partial<typeof settings>) {
    onBlueprintChange({
      ...blueprint,
      settings: { ...settings, ...patch },
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Aspect ratio</Label>
        <Select value={aspectRatio} onValueChange={(v) => onAspectRatioChange(v as SlideshowAspectRatio)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="4:5">4:5</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Default for new slides</Label>
        <Select
          value={settings.textMode}
          onValueChange={(v) => updateSettings({ textMode: v as SlideshowTextMode })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEXT_MODE_LABELS) as SlideshowTextMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {TEXT_MODE_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Language</Label>
        <Select
          value={settings.language}
          onValueChange={(v) => updateSettings({ language: v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
