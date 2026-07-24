"use client"

import * as React from "react"

import { CarouselShotsExamplePanel } from "@/components/tools/carousel-shots/carousel-shots-example-panel"
import { CarouselShotsHistoryPanel } from "@/components/tools/carousel-shots/carousel-shots-history-panel"
import { PillToggleGroup } from "@/components/shared/controls/pill-toggle-group"
import {
  UpscaleSettingsPopover,
  DEFAULT_CAROUSEL_UPSCALE_SETTINGS,
  type UpscaleSettings,
} from "@/components/tools/upscale/upscale-settings-popover"
import { CAROUSEL_UPSCALE_SETTINGS_STORAGE_KEY } from "@/lib/carousel-shots/constants"
import type {
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselShotsMetadata,
} from "@/lib/carousel-shots/types"

export type CarouselShotsRightView = "example" | "history"

export type CarouselShotsPendingJob = {
  id: string
  aspectRatio: CarouselPanelAspectRatio
  gridSize: CarouselGridSize
}

export type CarouselShotsPendingResult = {
  generationId: string
  metadata: CarouselShotsMetadata
}

function loadUpscaleSettings(): UpscaleSettings {
  if (typeof window === "undefined") return DEFAULT_CAROUSEL_UPSCALE_SETTINGS
  try {
    const raw = window.localStorage.getItem(CAROUSEL_UPSCALE_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_CAROUSEL_UPSCALE_SETTINGS
    return { ...DEFAULT_CAROUSEL_UPSCALE_SETTINGS, ...(JSON.parse(raw) as UpscaleSettings) }
  } catch {
    return DEFAULT_CAROUSEL_UPSCALE_SETTINGS
  }
}

type CarouselShotsRightPanelProps = {
  historyRefreshKey: number
  pendingJobs: CarouselShotsPendingJob[]
  pendingResults: CarouselShotsPendingResult[]
  regeneratingId: string | null
  focusedGenerationId?: string | null
  view: CarouselShotsRightView
  onRegenerate: (generationId: string) => Promise<void>
  onShotsChange: (generationId: string, shots: CarouselShotsMetadata["shots"]) => void
  onViewChange: (view: CarouselShotsRightView) => void
}

export function CarouselShotsRightPanel({
  historyRefreshKey,
  pendingJobs,
  pendingResults,
  regeneratingId,
  focusedGenerationId = null,
  view,
  onRegenerate,
  onShotsChange,
  onViewChange,
}: CarouselShotsRightPanelProps) {
  const [upscaleSettings, setUpscaleSettings] = React.useState<UpscaleSettings>(
    DEFAULT_CAROUSEL_UPSCALE_SETTINGS,
  )

  React.useEffect(() => {
    setUpscaleSettings(loadUpscaleSettings())
  }, [])

  const handleUpscaleSettingsChange = React.useCallback((next: UpscaleSettings) => {
    setUpscaleSettings(next)
    window.localStorage.setItem(CAROUSEL_UPSCALE_SETTINGS_STORAGE_KEY, JSON.stringify(next))
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <PillToggleGroup
          aria-label="Right panel view"
          className="min-w-[12rem]"
          fullWidth={false}
          value={view}
          onValueChange={onViewChange}
          options={[
            { value: "example", label: "Example" },
            { value: "history", label: "History" },
          ]}
        />
        <UpscaleSettingsPopover
          settings={upscaleSettings}
          onSettingsChange={handleUpscaleSettingsChange}
          align="end"
          triggerClassName="size-10 rounded-4xl"
        />
      </div>

      {view === "example" ? (
        <CarouselShotsExamplePanel />
      ) : (
        <CarouselShotsHistoryPanel
          historyRefreshKey={historyRefreshKey}
          pendingJobs={pendingJobs}
          pendingResults={pendingResults}
          regeneratingId={regeneratingId}
          focusedGenerationId={focusedGenerationId}
          upscaleSettings={upscaleSettings}
          onRegenerate={onRegenerate}
          onShotsChange={onShotsChange}
        />
      )}
    </div>
  )
}
