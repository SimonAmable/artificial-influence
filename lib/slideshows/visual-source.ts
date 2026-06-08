import { applySlideKind, inferSlideKind } from "@/lib/slideshows/slide-kind"
import type {
  ResolvedSlideshowSlide,
  SlideshowSlideKind,
  SlideshowVisualSource,
} from "@/lib/slideshows/types"

export const VISUAL_SOURCE_LABELS: Record<SlideshowVisualSource, string> = {
  collection: "Image pack",
  generate: "AI generate",
  manual: "Custom image",
  reuse: "Reuse slide",
}

export function clearResolvedVisual(
  slide: ResolvedSlideshowSlide,
): Pick<
  ResolvedSlideshowSlide,
  "sourceImageUrl" | "sourceCollectionImageId" | "generationId" | "finalImageUrl" | "status" | "errorMessage"
> {
  return {
    sourceImageUrl: null,
    sourceCollectionImageId: null,
    generationId: null,
    finalImageUrl: null,
    status: "pending",
    errorMessage: null,
  }
}

export function switchSlideKind(
  slide: ResolvedSlideshowSlide,
  kind: SlideshowSlideKind,
): ResolvedSlideshowSlide {
  const {
    index,
    sourceImageUrl: _sourceImageUrl,
    sourceCollectionImageId: _sourceCollectionImageId,
    generationId: _generationId,
    finalImageUrl: _finalImageUrl,
    status: _status,
    errorMessage: _errorMessage,
    ...blueprint
  } = slide

  return {
    ...applySlideKind(blueprint, kind),
    index,
    ...clearResolvedVisual(slide),
  }
}

export function slideKindForSource(source: SlideshowVisualSource): SlideshowSlideKind {
  if (source === "generate") return "ai"
  if (source === "manual") return "custom"
  return "pack"
}

export function switchVisualSource(
  slide: ResolvedSlideshowSlide,
  source: SlideshowVisualSource,
  reuseSlideId?: string | null,
): ResolvedSlideshowSlide {
  if (source === "reuse") {
    return {
      ...slide,
      ...clearResolvedVisual(slide),
      visual: {
        ...slide.visual,
        source: "reuse",
        reuseSlideId: reuseSlideId ?? slide.visual.reuseSlideId,
        collectionId: null,
        aiEditPrompt: null,
        prompt: "",
        manualAssetId: null,
        manualImageUrl: null,
      },
    }
  }

  const currentKind = inferSlideKind(slide)
  const kind = source === "collection" && currentKind === "character"
    ? "character"
    : slideKindForSource(source)

  return switchSlideKind(slide, kind)
}

export function queueSlideRegeneration(slide: ResolvedSlideshowSlide): ResolvedSlideshowSlide {
  return {
    ...slide,
    ...clearResolvedVisual(slide),
  }
}

export function pinCollectionImage(
  slide: ResolvedSlideshowSlide,
  image: { id: string; url: string },
): ResolvedSlideshowSlide {
  return {
    ...slide,
    sourceCollectionImageId: image.id,
    sourceImageUrl: image.url,
    status: "ready",
    errorMessage: null,
    visual: {
      ...slide.visual,
      variation: "fixed",
    },
  }
}

export function setManualImage(
  slide: ResolvedSlideshowSlide,
  input: { assetId: string | null; imageUrl: string },
): ResolvedSlideshowSlide {
  return {
    ...slide,
    sourceImageUrl: input.imageUrl,
    sourceCollectionImageId: null,
    generationId: null,
    finalImageUrl: null,
    status: "ready",
    errorMessage: null,
    visual: {
      ...slide.visual,
      source: "manual",
      manualAssetId: input.assetId,
      manualImageUrl: input.imageUrl,
    },
  }
}
