import type { ReactNode } from "react"

export interface AnswerCapsule {
  /** Exact phrasing of a likely user query; rendered as H2 and used in FAQPage JSON-LD */
  question: string
  /** 50–150 words, self-contained; avoid internal links inside the paragraph */
  answer: string
}

export type FeatureLandingBentoIconId =
  | "clock"
  | "globe"
  | "chat-circle-dots"
  | "users-three"
  | "sparkle"
  | "calendar"

export interface FeatureLandingBentoItem {
  name: string
  description: string
  href: string
  cta: string
  className: string
  icon: FeatureLandingBentoIconId
  media: { kind: "image" | "video"; src: string; alt: string }
}

export interface FeatureLandingFeatureRow {
  title: string
  description: string
  href?: string
  ctaLabel?: string
  mediaType: "image" | "video"
  mediaSrc: string
  mediaAlt: string
}

export interface FeatureLandingHowToStep {
  name: string
  text: string
}

export interface FeatureLandingStructuredData {
  includeSoftwareApplication?: boolean
  includeHowTo?: boolean
  breadcrumb?: Array<{ name: string; url: string }>
}

export interface FeatureLandingConfig {
  slug: string
  /** ISO 8601; WebPage schema datePublished */
  datePublished: string
  /** ISO 8601; visible “Last updated” + schema dateModified + sitemap */
  lastUpdated: string
  hero: {
    eyebrow?: string
    title: string
    tagline: string
    tldr: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
    media?: {
      kind: "image" | "video"
      src: string
      alt: string
      width?: number
      height?: number
    }
  }
  answerCapsules: AnswerCapsule[]
  bento?: { heading: string; items: FeatureLandingBentoItem[] }
  comparison?: {
    heading: string
    columns: string[]
    rows: Array<{ label: string; cells: string[] }>
  }
  features?: { heading: string; items: FeatureLandingFeatureRow[] }
  faq: { heading?: string; items: Array<{ question: string; answer: string }> }
  cta: { heading: string; body: string; buttons: Array<{ label: string; href: string; variant?: "default" | "outline" }> }
  howTo?: { name: string; description: string; steps: FeatureLandingHowToStep[] }
  seo: {
    title: string
    description: string
    canonical?: string
    ogImage?: string
    keywords?: string[]
    structuredData?: FeatureLandingStructuredData
  }
}

export interface FeatureLandingSlots {
  afterHero?: ReactNode
  beforeShowcase?: ReactNode
  afterShowcase?: ReactNode
  beforeFAQ?: ReactNode
  afterFAQ?: ReactNode
}
