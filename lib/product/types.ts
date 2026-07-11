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
  /** MCP OAuth/API host when it differs from the marketing site (e.g. mcp.unican.ai). */
  mcpSiteUrl?: string
  logo: string
  /** Header logo display size in px (fits inside the 44px circle on the 52px bar). */
  logoSizePx?: number
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
  /** When false, signed-in users skip onboarding redirects and /onboarding is unavailable. */
  onboardingEnabled: boolean
  pageOverrides?: {
    landing?: PageVariant
    onboarding?: PageVariant
    dashboard?: PageVariant
    pricing?: PageVariant
  }
}
