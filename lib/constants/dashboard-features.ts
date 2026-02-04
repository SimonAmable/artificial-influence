export type DashboardFeatureMedia = {
  type: "image" | "video"
  src: string
  poster?: string
}

export type DashboardFeature = {
  slug: string
  title: string
  description: string
  toolHref: string
  media: DashboardFeatureMedia
  highlights: string[]
}

export const dashboardFeatures: DashboardFeature[] = [
  {
    slug: "image",
    title: "Image Generation",
    description: "Turn text prompts into studio-grade visuals with a single prompt.",
    toolHref: "/image",
    media: {
      type: "image",
      src: "/hero_showcase_images/image_generation.png",
    },
    highlights: [
      "High-resolution generations",
      "Prompt enhancement built in",
      "Style-consistent outputs",
    ],
  },
  {
    slug: "video",
    title: "Video Generation",
    description: "Generate cinematic clips with motion, lighting, and consistency.",
    toolHref: "/video",
    media: {
      type: "video",
      src: "/hero_showcase_images/motion_copy_dance_1.mp4",
      poster: "/hero_showcase_images/image_generation_wide.png",
    },
    highlights: [
      "Dynamic camera movement",
      "Shot-to-shot consistency",
      "Fast iteration previews",
    ],
  },
  {
    slug: "motion-copy",
    title: "Motion Copy",
    description: "Animate a single image into a lively, shareable video.",
    toolHref: "/motion-copy",
    media: {
      type: "video",
      src: "/hero_showcase_images/motion_copy.mp4",
      poster: "/hero_showcase_images/image_editing_wide.png",
    },
    highlights: [
      "One-click motion presets",
      "Loop-ready clips",
      "Perfect for social formats",
    ],
  },
  {
    slug: "lipsync",
    title: "Lip Sync",
    description: "Match any voice to any face with precise lip alignment.",
    toolHref: "/lipsync",
    media: {
      type: "video",
      src: "/hero_showcase_images/lipsync_final.mp4",
      poster: "/hero_showcase_images/image_editing.png",
    },
    highlights: [
      "Natural facial motion",
      "Multi-language support",
      "Broadcast-ready exports",
    ],
  },
  {
    slug: "image-editing",
    title: "Image Editing",
    description: "Enhance, retouch, and restyle visuals with AI precision.",
    toolHref: "/influencer-generator",
    media: {
      type: "image",
      src: "/hero_showcase_images/influencer_generation_showcase.png",
    },
    highlights: [
      "Smart retouch tools",
      "Brand-style consistency",
      "Layered variation control",
    ],
  },
]
