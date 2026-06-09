import type {
  SlideshowSlideBlueprint,
  SlideshowSlideKind,
  SlideshowVisualRecipe,
} from "@/lib/slideshows/types"
import { defaultOverlay } from "@/lib/slideshows/text-treatment"

export const SLIDE_KIND_LABELS: Record<SlideshowSlideKind, string> = {
  ai: "AI Generated",
  pack: "Image Pack",
  custom: "Custom Slide",
  character: "Character",
}

const DEFAULT_ROLES = ["Hook", "Tip", "Tip", "Tip", "CTA"] as const

export function createSlideId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultVisualForKind(kind: SlideshowSlideKind): SlideshowVisualRecipe {
  switch (kind) {
    case "ai":
      return {
        source: "generate",
        collectionId: null,
        prompt: "Generate a scroll-stopping visual for this slide.",
        aiEditPrompt: null,
        reuseSlideId: null,
        variation: "fresh_each_run",
        modelIdentifier: null,
        locked: false,
        manualAssetId: null,
        manualImageUrl: null,
        referenceImages: [],
      }
    case "pack":
      return {
        source: "collection",
        collectionId: null,
        prompt: "",
        aiEditPrompt: null,
        reuseSlideId: null,
        variation: "prefer_unused",
        modelIdentifier: null,
        locked: false,
        manualAssetId: null,
        manualImageUrl: null,
        referenceImages: [],
      }
    case "custom":
      return {
        source: "manual",
        collectionId: null,
        prompt: "",
        aiEditPrompt: null,
        reuseSlideId: null,
        variation: "fixed",
        modelIdentifier: null,
        locked: false,
        manualAssetId: null,
        manualImageUrl: null,
        referenceImages: [],
      }
    case "character":
      return {
        source: "generate",
        collectionId: null,
        prompt: "Same character as the reference image. New scene matching the slide message.",
        aiEditPrompt: null,
        reuseSlideId: null,
        variation: "fresh_each_run",
        modelIdentifier: null,
        locked: false,
        manualAssetId: null,
        manualImageUrl: null,
        referenceImages: [],
      }
  }
}

export function inferSlideKind(slide: SlideshowSlideBlueprint): SlideshowSlideKind {
  if (slide.slideKind) return slide.slideKind
  if (slide.characterReferenceAssetId) return "character"
  if (slide.visual.source === "generate" && slide.role.toLowerCase().includes("character")) {
    return "character"
  }
  if (slide.visual.source === "generate") return "ai"
  if (slide.visual.source === "collection") {
    return slide.characterMode === "edit_pack" || slide.visual.aiEditPrompt
      ? "character"
      : "pack"
  }
  if (slide.visual.source === "manual") return "custom"
  return "pack"
}

export function applySlideKind(
  slide: SlideshowSlideBlueprint,
  kind: SlideshowSlideKind,
): SlideshowSlideBlueprint {
  const visual = defaultVisualForKind(kind)

  return {
    ...slide,
    slideKind: kind,
    characterMode: kind === "character" ? "generate" : undefined,
    characterReferenceAssetId: kind === "character" ? slide.characterReferenceAssetId ?? null : null,
    characterReferenceUrl: kind === "character" ? slide.characterReferenceUrl ?? null : null,
    visual: {
      ...visual,
      collectionId: kind === "pack" ? slide.visual.collectionId : visual.collectionId,
      prompt: kind === "ai" || kind === "character" ? slide.visual.prompt || visual.prompt : visual.prompt,
      aiEditPrompt: kind === "pack" ? slide.visual.aiEditPrompt : null,
      manualAssetId: kind === "custom" ? slide.visual.manualAssetId : null,
      manualImageUrl: kind === "custom" ? slide.visual.manualImageUrl : null,
      referenceImages: kind === "ai" || kind === "character" || kind === "pack"
        ? slide.visual.referenceImages ?? []
        : [],
    },
  }
}

export function createDefaultSlide(
  kind: SlideshowSlideKind,
  index: number,
  textTreatment: SlideshowSlideBlueprint["textTreatment"] = "off",
): SlideshowSlideBlueprint {
  const role = DEFAULT_ROLES[index % DEFAULT_ROLES.length] ?? `Slide ${index + 1}`
  return {
    id: createSlideId(),
    slideKind: kind,
    role,
    content: {
      role,
      prompt: kind === "pack" || kind === "custom"
        ? "Write short on-slide copy for this slide."
        : "Describe the visual and message for this slide.",
      resolvedText: "",
      variation: "fresh_each_run",
      locked: false,
    },
    visual: defaultVisualForKind(kind),
    overlays: textTreatment === "overlay" ? [defaultOverlay()] : [],
    textTreatment,
    characterMode: kind === "character" ? "generate" : undefined,
    characterReferenceAssetId: null,
    characterReferenceUrl: null,
  }
}

export function normalizeSlide(slide: SlideshowSlideBlueprint): SlideshowSlideBlueprint {
  const kind = inferSlideKind(slide)
  const normalized = applySlideKind(slide, kind)
  return {
    ...normalized,
    textTreatment: slide.textTreatment ?? "off",
    characterMode: kind === "character" ? "generate" : undefined,
    characterReferenceAssetId: slide.characterReferenceAssetId ?? null,
    characterReferenceUrl: slide.characterReferenceUrl ?? null,
    visual: {
      ...normalized.visual,
      referenceImages: slide.visual.referenceImages ?? [],
    },
  }
}
