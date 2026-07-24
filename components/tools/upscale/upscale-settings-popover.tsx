"use client"

import { SlidersHorizontal } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  SEEDVR2_MODEL_IDENTIFIER,
  UPSCALE_MODEL_IDENTIFIER,
  isSeedVr2ModelIdentifier,
} from "@/lib/upscale/constants"
import type { SeedVrStrength, UpscaleModelId, UpscaleSettings } from "@/lib/upscale/build-request-payload"
import { cn } from "@/lib/utils"

export type { SeedVrStrength, UpscaleModelId, UpscaleSettings } from "@/lib/upscale/build-request-payload"
export {
  buildUpscaleRequestPayload,
  DEFAULT_CAROUSEL_UPSCALE_SETTINGS,
  DEFAULT_UPSCALE_PAGE_SETTINGS,
} from "@/lib/upscale/build-request-payload"

type UpscaleSettingsPopoverProps = {
  settings: UpscaleSettings
  onSettingsChange: (next: UpscaleSettings) => void
  triggerClassName?: string
  align?: "center" | "start" | "end"
}

export function UpscaleSettingsPopover({
  settings,
  onSettingsChange,
  triggerClassName,
  align = "center",
}: UpscaleSettingsPopoverProps) {
  const isSeedVr = isSeedVr2ModelIdentifier(settings.modelIdentifier)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("size-10 shrink-0 rounded-full", triggerClassName)}
          aria-label="Upscale settings"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(92vw,280px)] space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="upscale-model" className="text-xs text-muted-foreground">
            Model
          </Label>
          <Select
            value={settings.modelIdentifier}
            onValueChange={(value) =>
              onSettingsChange({
                ...settings,
                modelIdentifier: value as UpscaleModelId,
              })
            }
          >
            <SelectTrigger id="upscale-model" className="h-9 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UPSCALE_MODEL_IDENTIFIER}>P-Image Upscale</SelectItem>
              <SelectItem value={SEEDVR2_MODEL_IDENTIFIER}>SeedVR2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSeedVr ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="seedvr-strength" className="text-xs text-muted-foreground">
                Restoration strength
              </Label>
              <Select
                value={settings.seedVrStrength}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    seedVrStrength: value as SeedVrStrength,
                  })
                }
              >
                <SelectTrigger id="seedvr-strength" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="strong">Strong</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="seedvr-color-fix" className="text-xs leading-snug">
                Preserve original colors
              </Label>
              <Switch
                id="seedvr-color-fix"
                checked={settings.seedVrColorFix}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, seedVrColorFix: checked })
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="upscale-target" className="text-xs text-muted-foreground">
                Target resolution
              </Label>
              <Select
                value={String(settings.targetMegapixels)}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    targetMegapixels: Number(value),
                  })
                }
              >
                <SelectTrigger id="upscale-target" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 6, 8].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} MP
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="enhance-realism" className="text-xs leading-snug">
                Enhance realism
              </Label>
              <Switch
                id="enhance-realism"
                checked={settings.enhanceRealism}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, enhanceRealism: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="enhance-details" className="text-xs leading-snug">
                Creative detail boost
              </Label>
              <Switch
                id="enhance-details"
                checked={settings.enhanceDetails}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, enhanceDetails: checked })
                }
              />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
