export type ProductId = "unican" | "presence-studio"

export type PageVariant = "default" | "presence"

export interface ProductMetadataConfig {
  title: string
  titleTemplate: string
  description: string
  ogImage?: string
}

export interface ProductLandingContent {
  heroTitle: string
  heroDescription: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
  previewAlt: string
}

export interface ProductConfig {
  id: ProductId
  name: string
  siteUrl: string
  logo: string
  /** Extra classes for header/shell logo images (e.g. skip dark:invert for full-color PNGs). */
  logoClassName?: string
  favicon: string
  appleTouchIcon?: string
  webManifest?: string
  themeClass: string
  metadata: ProductMetadataConfig
  landing: ProductLandingContent
  visibleRoutes: string[]
  defaultSignedInRoute: string
  assistantName: string
  pageOverrides?: {
    landing?: PageVariant
    onboarding?: PageVariant
    dashboard?: PageVariant
    pricing?: PageVariant
  }
}
