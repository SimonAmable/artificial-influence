import type { ProductId } from "@/lib/product/types"

export type GuideSectionId = "start" | "publish" | "platform"

export type GuideHubCard = {
  slug: string
  title: string
  description: string
  /** Optional; omit to use shader demo fallback on hub cards. */
  mediaSrc?: string
  mediaAlt?: string
  section: GuideSectionId
  /** When false, card is shown on the hub but not linked yet. */
  available: boolean
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

export type GuideStepDemoId =
  | "mention"
  | "batch"
  | "cull"
  | "shots-upload"
  | "shots-settings"
  | "shots-generate"
  | "fanvue-connect"
  | "fanvue-media"
  | "fanvue-publish"

export type GuideStep = {
  title: string
  body: string
  /** Optional deep link shown under the step. */
  ctaLabel?: string
  ctaHref?: string
  /** Optional GSAP motion demo for alternating step layout. */
  demo?: GuideStepDemoId
  /** When set, step only shows for these products (e.g. Fanvue on Presence). */
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

/** How options in a path group relate to each other. */
export type GuidePathRelation = "or" | "and" | "steps"

export type GuidePathCard = {
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
  /** Short meta line (e.g. "1 photo · free"). */
  meta?: string
  mediaSrc?: string
  mediaAlt?: string
}

export type GuideToolLink = {
  label: string
  href: string
}

/** Scene / brief tab that fills the guide prompt try box. */
export type GuidePromptTryTab = {
  id: string
  label: string
  prompt: string
}

/**
 * Interactive tab strip + real agent prompt box.
 * Send / open-agent hand off to chat with the current prompt.
 */
export type GuidePromptTry = {
  heading?: string
  tabs: GuidePromptTryTab[]
  /** Destination after send; defaults to /chat with handoff. */
  submitHref?: string
}

/** Live upload that opens Carousel Shots with the image prefilled. */
export type GuideCarouselUpload = {
  heading?: string
  description?: string
}

/** Pick a keeper and open Create Fanvue post. */
export type GuideFanvueTry = {
  heading?: string
  description?: string
}

export type GuideLogoChip = {
  src: string
  label: string
}

/** Static info block for text-first guides (no demos / shaders). */
export type GuideInfoSection = {
  title: string
  body: string
  logos?: GuideLogoChip[]
  ctaLabel?: string
  ctaHref?: string
}

/** Simple comparison table for info guides. */
export type GuideCompareTable = {
  heading: string
  description?: string
  /** Column headers; first is the row label column. */
  columns: string[]
  rows: Array<{
    label: string
    values: string[]
  }>
  footnote?: string
  sources?: Array<{
    label: string
    href: string
  }>
}

export type GuideArticle = {
  slug: string
  title: string
  /** One-line outcome under the title. */
  result: string
  /** Short orientation before path chooser / steps. */
  overview?: string
  timeEstimate: string
  tools: GuideToolLink[]
  primaryCtaLabel: string
  primaryCtaHref: string
  mediaSrc?: string
  mediaAlt?: string
  /**
   * `demo` (default): shader hero + optional GSAP steps.
   * `info`: text-first — no shader hero; use infoSections + optional logoStrip.
   */
  presentation?: "demo" | "info"
  /** Vendor logos under the header on info guides. */
  logoStrip?: GuideLogoChip[]
  /** Optional path chooser (e.g. Direct Save / Merge / Build). */
  paths?: GuidePathCard[]
  pathsHeading?: string
  /** Defaults to "or" when paths are present. */
  pathsRelation?: GuidePathRelation
  /** Optional Cursor-style tabs + real prompt box try block. */
  promptTry?: GuidePromptTry
  stepsHeading?: string
  steps?: GuideStep[]
  infoSectionsHeading?: string
  infoSections?: GuideInfoSection[]
  compareTable?: GuideCompareTable
  /** Optional upload → open in Carousel Shots. */
  carouselUpload?: GuideCarouselUpload
  /** Optional keeper picker → Create Fanvue post. */
  fanvueTry?: GuideFanvueTry
  /** Concrete finish-line outcomes. Prefer over checklist homework. */
  outcomes?: string[]
  outcomesHeading?: string
  nextGuideSlug: string | null
  nextGuideLabel: string | null
  askAgentPrompt: string
}
