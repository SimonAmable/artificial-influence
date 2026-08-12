import { mapSettingsToMiniGlAdjustments } from "./grading-cpu"
import type { MiniGlPipeline, MiniGlPresetConfig } from "./minigl-params"
import { MAX_FILTER_GRAIN } from "./minigl-params"
import type { ImageFilterSettings } from "./types"

export function buildMiniGlPipeline(
  settings: ImageFilterSettings,
  presetConfig?: MiniGlPresetConfig
): MiniGlPipeline {
  const grain = Math.min(MAX_FILTER_GRAIN, Math.max(0, settings.grain))

  if (presetConfig) {
    return {
      insta: presetConfig.insta,
      adjustments: presetConfig.adjustments,
      highlightsShadows: presetConfig.highlightsShadows,
      grain,
    }
  }

  return {
    adjustments: mapSettingsToMiniGlAdjustments(settings),
    grain,
  }
}
