import type { ProductId } from "@/lib/product/types"

export const HERO_SHOWCASE_DURATION_MS = 7000

export type HeroShowcaseMediaItem = {
  id: string
  kind: "image" | "video"
  src: string
}

export const UNICAN_HERO_SHOWCASE_MEDIA: HeroShowcaseMediaItem[] = [
  {
    id: "demo-hero-1",
    kind: "video",
    src: "/hero_showcase_images/demo_hero_vids/compressed/d1.webm",
  },
  {
    id: "demo-hero-2",
    kind: "video",
    src: "/hero_showcase_images/demo_hero_vids/compressed/d2.webm",
  },
  {
    id: "demo-hero-3",
    kind: "video",
    src: "/hero_showcase_images/demo_hero_vids/compressed/d3.webm",
  },
  {
    id: "demo-hero-4",
    kind: "video",
    src: "/hero_showcase_images/demo_hero_vids/compressed/d4.webm",
  },
]

export const PRESENCE_HERO_SHOWCASE_MEDIA: HeroShowcaseMediaItem[] = [
  {
    id: "presence-hero-1",
    kind: "image",
    src: "/hero_showcase_images/presence/1.jpeg",
  },
  {
    id: "presence-hero-2",
    kind: "image",
    src: "/hero_showcase_images/presence/2.png",
  },
  {
    id: "presence-hero-3",
    kind: "image",
    src: "/hero_showcase_images/presence/3.jpg",
  },
  {
    id: "presence-hero-4",
    kind: "image",
    src: "/hero_showcase_images/presence/4.jpg",
  },
]

export function getHeroShowcaseMedia(productId: ProductId): HeroShowcaseMediaItem[] {
  switch (productId) {
    case "unican":
      return UNICAN_HERO_SHOWCASE_MEDIA
    case "presence-studio":
      return PRESENCE_HERO_SHOWCASE_MEDIA
    default: {
      const exhaustiveCheck: never = productId
      return exhaustiveCheck
    }
  }
}
