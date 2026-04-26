export type WebResearchProvider = "simple" | "firecrawl"

export type WebSearchResult = {
  source: string | null
  snippet: string | null
  title: string
  url: string
}

export type WebPageLink = {
  text: string | null
  url: string
}

export type WebPageImage = {
  alt: string | null
  url: string
}

export type WebPageReadResult = {
  description: string | null
  finalUrl: string
  images: WebPageImage[]
  links: WebPageLink[]
  markdown: string
  provider: WebResearchProvider
  text: string
  title: string | null
  url: string
}

export type WebImageSearchResult = {
  height?: number | null
  imageUrl: string
  sourceDomain: string | null
  sourcePageUrl: string
  title: string
  width?: number | null
}

export type WebScreenshotResult = {
  fullPage: boolean
  provider: "firecrawl"
  screenshotUrl: string
  sourceUrl: string
}

export type ScreenshotUploadResult = {
  fullPage: boolean
  provider: "firecrawl"
  sourceUrl: string
  storagePath: string
  url: string
  viewportHeight: number
  viewportWidth: number
}
