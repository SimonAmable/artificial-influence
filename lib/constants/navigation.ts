/**
 * Shared navigation items for app header and canvas header
 */

export interface NavigationItem {
  path: string
  label: string
  /**
   * Whether this item should only appear in development mode
   */
  devOnly?: boolean
  /**
   * Custom styling class names for the navigation item
   */
  className?: string
}

export type MegaNavBadge = "new" | "popular" | "beta"

/** Phosphor icons for feature rows, clearer than generic brand SVGs for create/edit flows */
export type MegaNavPhosphorIcon =
  | "image"
  | "video"
  | "paint-brush"
  | "film-strip"
  | "flow-arrow"
  | "microphone"
  | "chat-circle-dots"
  | "robot"

export interface MegaNavItem {
  path: string
  label: string
  description: string
  badge?: MegaNavBadge
  iconSrc?: string
  iconText?: string
  /** When set, header renders this Phosphor icon instead of iconSrc */
  iconPhosphor?: MegaNavPhosphorIcon
  /** Replicate-style model id, surfaced on menu items as data-model-identifier */
  modelIdentifier?: string
}

export interface MegaNavSection {
  title: "Features" | "Models"
  items: MegaNavItem[]
}

export interface MegaNavGroup {
  label: string
  badge?: MegaNavBadge
  path?: string
  sections?: MegaNavSection[]
  simpleItems?: MegaNavItem[]
}

export type DashboardToolIcon =
  | "palette"
  | "flow-arrow"
  | "microphone"
  | "image"
  | "video"
  | "paint-brush"
  | "arrows-left-right"
  | "users"
  | "pencil-simple"
  | "squares-four"
  | "chat-circle-dots"
  | "robot"

export interface DashboardToolNavItem {
  label: string
  href: string
  hint: string
  icon: DashboardToolIcon
}

const baseNavigationItems: NavigationItem[] = [
  { path: "/", label: "Home" },
  { path: "/chat", label: "Agent" },
  { path: "/automations", label: "Automations" },
  { path: "/image", label: "Image" },
  { path: "/video", label: "Video" },
  { path: "/audio", label: "Audio" },
  { path: "/brand", label: "Brand" },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
  { path: "/inpaint", label: "Image Editing" },
  { path: "/character-swap", label: "Character Swap" },
  { path: "/canvases", label: "Canvas" },
  { path: "/apps", label: "Apps" },
  { path: "/editor", label: "Editor" },
  { path: "/autopost", label: "Autopost" },
  { path: "/history", label: "History" },
  { path: "/assets", label: "Assets" },
  { path: "/pricing-test", label: "Pricing (Test)", devOnly: true },
  { path: "/pricing", label: "Pricing" },
]

/**
 * Get navigation items with dynamic styling based on their properties
 * - Test pages (containing "test" in path or label) get yellow styling
 * - Dev-only items are filtered out in production
 */
export function getNavigationItems(): NavigationItem[] {
  const items = baseNavigationItems
    .filter((item) => !item.devOnly || process.env.NODE_ENV === "development")
    .map((item) => {
      // Apply yellow styling for test pages
      const isTestPage =
        item.path.toLowerCase().includes("test") ||
        item.label.toLowerCase().includes("test")

      return {
        ...item,
        className: isTestPage ? "text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300" : undefined,
      }
    })

  return items
}

/**
 * Static export for components that need the raw array
 */
export const navigationItems = getNavigationItems()

/**
 * Dedicated desktop mega-menu data.
 * Keep this separate so existing navigationItems consumers are unaffected.
 */
export const megaNavGroups: MegaNavGroup[] = [
  {
    label: "Agent",
    path: "/chat",
    badge: "beta",
    simpleItems: [
      {
        path: "/chat",
        label: "Agent",
        description: "Open AI chat to plan and create faster",
        badge: "beta",
        iconPhosphor: "chat-circle-dots",
      },
      {
        path: "/automations",
        label: "Automations",
        description: "Easily set up automated creation and posting to Instagram",
        badge: "beta",
        iconPhosphor: "robot",
      },
    ],
  },
  {
    label: "Image",
    path: "/image",
    sections: [
      {
        title: "Features",
        items: [
          {
            path: "/image",
            label: "Create Image",
            description: "Generate AI images",
            badge: "new",
            iconPhosphor: "image",
          },
          {
            path: "/character-swap",
            label: "Character Swap",
            description: "Create realistic character swaps",
            badge: "new",
            iconSrc: "/users-icon.svg",
          },
          {
            path: "/inpaint",
            label: "Image Editing",
            description: "Select area and edit",
            iconPhosphor: "paint-brush",
          },
        ],
      },
      {
        title: "Models",
        items: [
          {
            path: "/image?model=google/nano-banana-2",
            label: "Nano Banana 2",
            description: "Fast high-quality image generation",
            badge: "popular",
            iconSrc: "/ai_icons/gemini-color.svg",
          },
          {
            path: "/image?model=openai/gpt-image-2",
            label: "GPT Image 2",
            description: "OpenAI image generation on Fal",
            badge: "new",
            iconSrc: "/ai_icons/openai.svg",
          },
          {
            path: "/image?model=xai/grok-imagine-image",
            label: "Grok Imagine",
            description: "Versatile image styles",
            badge: "popular",
            iconSrc: "/ai_icons/grok.svg",
          },
          {
            path: "/image?model=bytedance/seedream-5-lite",
            label: "Seedream 5.0",
            description: "ByteDance reasoning, refs, up to 3K",
            iconSrc: "/ai_icons/bytedance-color.svg",
          },
          {
            path: "/image?model=prunaai/z-image-turbo",
            label: "Z-Image Turbo",
            description: "Ultra-fast 6B text-to-image",
            iconSrc: "/ai_icons/flux.svg",
          },
        ],
      },
    ],
  },
  {
    label: "Video",
    path: "/video",
    sections: [
      {
        title: "Features",
        items: [
          {
            path: "/video",
            label: "Create Video",
            description: "Text or image to video generation",
            iconPhosphor: "video",
          },
          {
            path: "/editor",
            label: "Video Editor",
            description: "Remotion timeline and canvas",
            badge: "new",
            iconPhosphor: "film-strip",
          },
          {
            path: "/motion-copy",
            label: "Motion Copy",
            description: "Transfer movement patterns",
            badge: "popular",
            iconSrc: "/users-icon.svg",
          },
          {
            path: "/lipsync",
            label: "Lipsync",
            description: "Sync voice with character",
            iconPhosphor: "microphone",
          },
        ],
      },
      {
        title: "Models",
        items: [
          {
            path: "/video?model=xai/grok-imagine-video",
            label: "Grok Imagine Video",
            description: "Creative video generation",
            iconSrc: "/ai_icons/grok.svg",
          },
          {
            path: "/video?model=google/veo-3.1-fast",
            label: "Veo 3.1 Fast",
            description: "High-fidelity video with native audio",
            iconSrc: "/ai_icons/gemini-color.svg",
          },
          {
            path: "/video?model=bytedance/seedance-2.0",
            label: "Seedance 2.0",
            description: "Multimodal video with reference audio and frames",
            badge: "new",
            iconSrc: "/ai_icons/bytedance-color.svg",
            modelIdentifier: "bytedance/seedance-2.0",
          },
          {
            path: "/video?model=kwaivgi/kling-v3-motion-control",
            label: "Kling 3.0 Motion Control",
            description: "Transfer motion from reference video",
            iconSrc: "/ai_icons/kling-color.svg",
          },
          {
            path: "/video?model=kwaivgi/kling-v3-video",
            label: "Kling V3 Video",
            description: "Cinematic text and image to video",
            badge: "new",
            iconSrc: "/ai_icons/kling-color.svg",
          },
        ],
      },
    ],
  },
  {
    label: "Audio",
    path: "/audio",
    badge: "new",
  },
  {
    label: "Assets",
    path: "/assets",
    simpleItems: [
      { path: "/assets", label: "Assets", description: "Store and sort your generated assets", iconSrc: "/window.svg", badge: "new" },
      { path: "/history", label: "History", description: "Past generations and edits", iconSrc: "/file.svg" },
      {
        path: "/automations",
        label: "Automations",
        description: "Easily set up automated creation and posting to Instagram",
        iconSrc: "/globe.svg",
      },
      { path: "/brand", label: "Brand", description: "Manage brand settings", iconSrc: "/logo.svg", badge: "new" },
    ],
  },
  { label: "Canvas", path: "/canvases" },
  { label: "Apps", path: "/apps", badge: "new" },
  { label: "Autopost", path: "/autopost", badge: "new" },
  { label: "Automations", path: "/automations", badge: "beta" },
  { label: "Pricing", path: "/pricing" },
]

/** Minimal link shape for footer columns (mirrors mega menu). */
export interface FooterMegaNavLink {
  path: string
  label: string
}

/**
 * Footer columns aligned with the desktop mega menu: Image tools, Video tools,
 * Other tools (Assets + top-level links), and split Image / Video models.
 */
export function getFooterMegaNavColumns(): {
  imageTools: FooterMegaNavLink[]
  videoTools: FooterMegaNavLink[]
  otherTools: FooterMegaNavLink[]
  imageModels: FooterMegaNavLink[]
  videoModels: FooterMegaNavLink[]
} {
  const dedupeLinks = (links: FooterMegaNavLink[]): FooterMegaNavLink[] => {
    const seen = new Set<string>()
    return links.filter((link) => {
      const key = `${link.path}-${link.label}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  const toLinks = (items: MegaNavItem[]): FooterMegaNavLink[] =>
    items.map((i) => ({ path: i.path, label: i.label }))

  const imageGroup = megaNavGroups.find((g) => g.label === "Image")
  const videoGroup = megaNavGroups.find((g) => g.label === "Video")
  const assetsGroup = megaNavGroups.find((g) => g.label === "Assets")

  const imageTools = toLinks(
    imageGroup?.sections?.find((s) => s.title === "Features")?.items ?? [],
  )
  const videoTools = toLinks(
    videoGroup?.sections?.find((s) => s.title === "Features")?.items ?? [],
  )
  const imageModels = toLinks(
    imageGroup?.sections?.find((s) => s.title === "Models")?.items ?? [],
  )
  const videoModels = toLinks(
    videoGroup?.sections?.find((s) => s.title === "Models")?.items ?? [],
  )

  const otherTools: FooterMegaNavLink[] = []
  if (assetsGroup?.simpleItems?.length) {
    for (const item of assetsGroup.simpleItems) {
      otherTools.push({ path: item.path, label: item.label })
    }
  }
  for (const g of megaNavGroups) {
    if (g.path && !g.sections?.length && !g.simpleItems?.length) {
      otherTools.push({ path: g.path, label: g.label })
    }
  }

  return {
    imageTools: dedupeLinks(imageTools),
    videoTools: dedupeLinks(videoTools),
    otherTools: dedupeLinks(otherTools),
    imageModels: dedupeLinks(imageModels),
    videoModels: dedupeLinks(videoModels),
  }
}

/**
 * Dashboard quick-action tools.
 * Keep this alongside navigation constants so dashboard and nav stay aligned.
 */
export const dashboardToolNavItems: DashboardToolNavItem[] = [
  {
    label: "Agent",
    href: "/chat",
    icon: "chat-circle-dots",
    hint: "Open AI chat to plan and create faster.",
  },
  {
    label: "Automations",
    href: "/automations",
    icon: "robot",
    hint: "Set up automated creation and posting workflows.",
  },
  {
    label: "Image Studio",
    href: "/image",
    icon: "image",
    hint: "Generate images from text and references.",
  },
  {
    label: "Video Studio",
    href: "/video",
    icon: "video",
    hint: "Text or image to video generation.",
  },
  {
    label: "Audio Studio",
    href: "/audio",
    icon: "microphone",
    hint: "Voiceovers and change-voice video generation in one dock.",
  },
  {
    label: "Brand kit",
    href: "/brand",
    icon: "palette",
    hint: "Logos, colors, type, and voice for consistent AI output.",
  },
  {
    label: "Motion Copy",
    href: "/motion-copy",
    icon: "users",
    hint: "Copy motion from ads or dance clips onto your character-animate a still with prompts.",
  },
  {
    label: "Lip Sync",
    href: "/lipsync",
    icon: "microphone",
    hint: "Sync speech to a face in an image or clip.",
  },
  {
    label: "Image Editing",
    href: "/inpaint",
    icon: "paint-brush",
    hint: "Edit regions of an image with prompts.",
  },
  {
    label: "Character Swap",
    href: "/character-swap",
    icon: "arrows-left-right",
    hint: "Swap a subject while keeping the scene.",
  },
  {
    label: "Workflow",
    href: "/canvases",
    icon: "pencil-simple",
    hint: "Node-based pipelines and canvas projects.",
  },
  {
    label: "Apps",
    href: "/apps",
    icon: "squares-four",
    hint: "Explore ready-made AI apps and tools.",
  },
  {
    label: "Video Editor",
    href: "/editor",
    icon: "video",
    hint: "Edit and assemble AI videos on a timeline.",
  },
  {
    label: "Autopost",
    href: "/autopost",
    icon: "palette",
    hint: "Schedule and publish your generated content.",
  },
  {
    label: "History",
    href: "/history",
    icon: "pencil-simple",
    hint: "Review past generations and edits.",
  },
  {
    label: "Assets",
    href: "/assets",
    icon: "squares-four",
    hint: "Browse and manage your saved assets.",
  },
]
