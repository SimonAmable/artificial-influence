import type { SlideshowSlideBlueprint } from "@/lib/slideshows/types"

export function collectSlideReferenceUrls(slide: SlideshowSlideBlueprint): string[] {
  const urls: string[] = []

  if (slide.characterReferenceUrl) {
    urls.push(slide.characterReferenceUrl)
  }

  for (const reference of slide.visual.referenceImages ?? []) {
    if (reference.url && !urls.includes(reference.url)) {
      urls.push(reference.url)
    }
  }

  return urls
}
