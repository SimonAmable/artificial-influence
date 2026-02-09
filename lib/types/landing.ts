export type LandingMediaType = "image" | "video"

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
