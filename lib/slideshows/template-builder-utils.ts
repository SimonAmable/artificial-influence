import { applyTextDefaultsToOverlays } from "@/lib/slideshows/overlay-text-style"
import { createDefaultSlide, normalizeSlide } from "@/lib/slideshows/slide-kind"
import { applyBlueprintTextRules } from "@/lib/slideshows/text-treatment"
import {
  slideshowBlueprintStoredSchema,
  slideshowProjectSlidesStoredSchema,
  type ResolvedSlideshowSlide,
  type SlideshowAspectRatio,
  type SlideshowBlueprint,
  type SlideshowBlueprintStored,
  type SlideshowSlideBlueprint,
  type SlideshowSlideKind,
  type SlideshowTemplate,
  type SlideshowTemplateSettings,
} from "@/lib/slideshows/types"
import { normalizeSlideTextTreatment } from "@/lib/slideshows/text-treatment"

export function defaultTemplateSettings(): SlideshowTemplateSettings {
  return {
    brandKitId: null,
    mode: "custom",
    language: "en",
    textMode: "off",
    textDefaults: {
      fontSize: "normal",
      textWidth: "narrow",
      style: "minimal",
    },
    defaultCharacterAssetId: null,
    defaultCharacterPreviewUrl: null,
  }
}

export function createInitialBlueprint(slideCount = 5): SlideshowBlueprint {
  const slides = Array.from({ length: slideCount }, (_, index) => {
    const kind: SlideshowSlideKind = index === 0 ? "character" : "pack"
    return createDefaultSlide(kind, index, defaultTemplateSettings().textMode)
  })
  return {
    creativeDirection: "",
    settings: defaultTemplateSettings(),
    slides,
  }
}

export function normalizeBlueprint(blueprint: SlideshowBlueprint | SlideshowBlueprintStored): SlideshowBlueprint {
  const settings = {
    ...defaultTemplateSettings(),
    ...blueprint.settings,
    textDefaults: {
      ...defaultTemplateSettings().textDefaults,
      ...blueprint.settings?.textDefaults,
    },
  }
  const normalized = applyBlueprintTextRules({
    ...blueprint,
    creativeDirection: blueprint.creativeDirection ?? "",
    settings,
    slides: blueprint.slides.map((slide) => normalizeSlide(slide as SlideshowSlideBlueprint)),
  })

  return {
    ...normalized,
    slides: normalized.slides.map((slide) => applyTextDefaultsToOverlays(
      slide,
      settings.textDefaults.style,
    )),
  }
}

export function parseSlideshowBlueprint(data: unknown): SlideshowBlueprint {
  return normalizeBlueprint(slideshowBlueprintStoredSchema.parse(data))
}

export function parseProjectSlides(data: unknown): ResolvedSlideshowSlide[] {
  return slideshowProjectSlidesStoredSchema.parse(data).map((slide) => ({
    ...slide,
    ...normalizeSlideTextTreatment(slide),
  }))
}

export function blueprintFromTemplate(template: SlideshowTemplate): SlideshowBlueprint {
  return normalizeBlueprint(template.blueprint)
}

export function buildSavePayload(input: {
  name: string
  description?: string
  aspectRatio: SlideshowAspectRatio
  blueprint: SlideshowBlueprint
}) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    aspectRatio: input.aspectRatio,
    blueprint: normalizeBlueprint(input.blueprint),
  }
}
