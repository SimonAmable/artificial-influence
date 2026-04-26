/**
 * Paths and lastModified for app/sitemap.ts. Keep in sync with public/llms.txt when adding landings.
 * `/automations` lastModified is synced from `automationsLanding.lastUpdated` in feature-landings/automations.ts.
 * `/canvases` lastModified is synced from `canvasesLanding.lastUpdated` in feature-landings/canvases.ts.
 */
import { automationsLanding } from "@/lib/constants/feature-landings/automations"
import { canvasesLanding } from "@/lib/constants/feature-landings/canvases"

const DEFAULT_LAST = new Date("2026-04-18T12:00:00.000Z")

export function getSitemapEntries(): Array<{
  path: string
  lastModified: Date
  changeFrequency: "weekly" | "monthly"
  priority: number
}> {
  return [
    { path: "/", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 1 },
    { path: "/image", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.9 },
    { path: "/video", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.9 },
    { path: "/audio", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.85 },
    { path: "/lipsync", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.85 },
    { path: "/motion-copy", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.85 },
    { path: "/inpaint", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.85 },
    { path: "/pricing", lastModified: DEFAULT_LAST, changeFrequency: "monthly", priority: 0.8 },
    { path: "/autopost", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.85 },
    { path: "/free-tools", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.8 },
    { path: "/free-tools/metadata-remover", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.8 },
    { path: "/free-tools/image-compressor", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.8 },
    { path: "/free-tools/video-compressor", lastModified: DEFAULT_LAST, changeFrequency: "weekly", priority: 0.8 },
    {
      path: "/canvases",
      lastModified: new Date(canvasesLanding.lastUpdated),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      path: "/automations",
      lastModified: new Date(automationsLanding.lastUpdated),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ]
}
