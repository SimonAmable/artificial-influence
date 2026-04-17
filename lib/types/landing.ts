export type LandingMediaType = "image" | "video"

/** Background for a single models bento tile (image or video). */
export interface LandingBentoCardMedia {
  mediaType: LandingMediaType
  src: string
}

export interface LandingCanvasNodeSeed {
  id: string
  label: string
  mediaType: LandingMediaType
  mediaSrc: string
  position: {
    x: number
    y: number
  }
}

export interface LandingWorkflowItem {
  category: string
  title: string
  description: string
  mediaType: LandingMediaType
  mediaSrc: string
  backgroundSrc?: string
  backgroundType?: LandingMediaType
  href: string
}

export interface LandingModelCard {
  name: string
  tagline: string
  mediaType: LandingMediaType
  mediaSrc: string
  href: string
}

export interface LandingProcessStep {
  step: string
  title: string
  description: string
  mediaType: LandingMediaType
  mediaSrc: string
}

/** Landing tiles: image screenshots vs. animated automation connector. */
export type LandingPlatformSurfaceCard =
  | {
      kind: "image"
      id: string
      name: string
      description: string
      href: string
      cta: string
      imageSrc: string
      imageAlt: string
      layoutClass: string
    }
  | {
      kind: "automation"
      id: string
      name: string
      description: string
      href: string
      cta: string
      layoutClass: string
    }
