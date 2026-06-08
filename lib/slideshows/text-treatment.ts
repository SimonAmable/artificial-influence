import type {
  SlideshowBlueprint,
  SlideshowBlueprintStored,
  SlideshowSlideBlueprint,
  SlideshowSlideBlueprintStored,
  SlideshowTemplateSettings,
  SlideshowTextMode,
  SlideshowTextTreatment,
} from "@/lib/slideshows/types"

export type ResolvedTextTreatment = "off" | "overlay"

const LEGACY_TEXT_MODES = new Set(["auto", "baked"])

export function briefDisablesOverlays(brief: string) {
  return /\bno\s+text\s+overlays?\b/i.test(brief)
}

export function normalizeTextMode(value: unknown): SlideshowTextMode {
  if (value === "overlay" || value === "off") return value
  if (typeof value === "string" && LEGACY_TEXT_MODES.has(value)) return "off"
  return "off"
}

export function migrateTextTreatment(
  slide: Pick<SlideshowSlideBlueprintStored, "textTreatment" | "overlays">,
  templateDefault: ResolvedTextTreatment = "off",
): ResolvedTextTreatment {
  const raw = slide.textTreatment as string | undefined
  if (raw === "overlay" || raw === "off") return raw
  if (raw === "baked") return "off"
  if (raw === "inherit") {
    const hasOverlayCopy = slide.overlays.some(
      (overlay) => overlay.resolvedText.trim().length > 0 || overlay.prompt.trim().length > 0,
    )
    return hasOverlayCopy ? "overlay" : templateDefault
  }
  return templateDefault
}

export function resolveSlideTextTreatment(
  slide: Pick<SlideshowSlideBlueprintStored, "textTreatment" | "overlays">,
  settings?: Pick<SlideshowTemplateSettings, "textMode">,
): ResolvedTextTreatment {
  const templateDefault = normalizeTextMode(settings?.textMode) === "overlay" ? "overlay" : "off"
  return migrateTextTreatment(slide, templateDefault)
}

export function slideUsesOverlayText(
  slide: Pick<SlideshowSlideBlueprintStored, "textTreatment" | "overlays">,
  settings?: Pick<SlideshowTemplateSettings, "textMode">,
) {
  return resolveSlideTextTreatment(slide, settings) === "overlay"
}

export function createOverlayId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultOverlay(role = "Caption") {
  return {
    id: createOverlayId(),
    role,
    prompt: "",
    resolvedText: "",
    position: "center" as const,
    style: "minimal" as const,
    locked: false,
    variation: "fresh_each_run" as const,
  }
}

export function normalizeSlideTextTreatment(
  slide: SlideshowSlideBlueprintStored,
  settings?: SlideshowTemplateSettings,
): SlideshowSlideBlueprint {
  const textTreatment = resolveSlideTextTreatment(slide, settings) satisfies SlideshowTextTreatment
  if (textTreatment === "off") {
    return {
      ...slide,
      textTreatment: "off",
      overlays: [],
    }
  }
  return {
    ...slide,
    textTreatment: "overlay",
    overlays: slide.overlays,
  }
}

export function applyBlueprintTextRules(
  blueprint: SlideshowBlueprintStored,
  options?: { forceOff?: boolean },
): SlideshowBlueprint {
  const settings = {
    ...blueprint.settings,
    textMode: normalizeTextMode(blueprint.settings?.textMode),
  }

  return {
    ...blueprint,
    settings,
    slides: blueprint.slides.map((slide) => {
      const migrated = normalizeSlideTextTreatment(slide, settings)
      if (options?.forceOff) {
        return { ...migrated, textTreatment: "off" as const, overlays: [] }
      }
      return migrated
    }),
  } as SlideshowBlueprint
}
