import { WAN_30_MODEL } from "@/lib/constants/latest-media-models"
import type { Model } from "@/lib/types/models"
import { GENJUTSU_BASE_MODEL, GENJUTSU_DISPLAY_NAME, GENJUTSU_UI_MODEL } from "./constants"

export function injectGenjutsuIntoVideoModels(models: Model[]): Model[] {
  if (models.some((model) => model.identifier === GENJUTSU_UI_MODEL)) return models

  if (models.length === 0) return models

  const base = models.find((model) => model.identifier === GENJUTSU_BASE_MODEL) ?? WAN_30_MODEL
  return [...models, toGenjutsuModel(base)]
}

function toGenjutsuModel(base: Model): Model {
  return {
    ...base,
    id: `ui-${GENJUTSU_UI_MODEL}`,
    identifier: GENJUTSU_UI_MODEL,
    name: GENJUTSU_DISPLAY_NAME,
    description: "Motion swap that keeps the character's identity.",
    parameters: { parameters: [] },
    supports_first_frame: false,
    supports_last_frame: false,
    supports_reference_image: true,
    supports_reference_video: true,
    aspect_ratios: ["adaptive"],
    default_aspect_ratio: "adaptive",
  }
}
