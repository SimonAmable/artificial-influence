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

export type MegaNavBadge = "new" | "popular"

export interface MegaNavItem {
  path: string
  label: string
  description: string
  badge?: MegaNavBadge
  iconSrc?: string
  iconText?: string
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
  | "pencil-simple"
  | "squares-four"
  | "chat-circle-dots"

export interface DashboardToolNavItem {
  label: string
  href: string
  hint: string
  icon: DashboardToolIcon
}

const baseNavigationItems: NavigationItem[] = [
  { path: "/", label: "Home" },
  { path: "/canvases", label: "Canvas" },
  { path: "/image", label: "Image" },
  { path: "/video", label: "Video" },
  { path: "/inpaint", label: "Image Editing" },
  { path: "/character-swap", label: "Character Swap" },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
  { path: "/apps", label: "Apps" },
  { path: "/assets", label: "Assets" },
  { path: "/autopost", label: "Autopost" },
  { path: "/brand", label: "Brand" },
  { path: "/chat", label: "Agent" },
  { path: "/history", label: "History" },
  { path: "/pricing", label: "Pricing" },
  { path: "/pricing-test", label: "Pricing (Test)", devOnly: true },
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
            iconSrc: "/ai_icons/openai.svg",
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
            iconSrc: "/swap-icon.svg",
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
            path: "/image?model=openai/gpt-image-1.5",
            label: "GPT Image 1.5",
            description: "True-color precision rendering",
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
            badge: "new",
            iconSrc: "/ai_icons/bytedance-color.svg",
          },
          {
            path: "/image?model=prunaai/z-image-turbo",
            label: "Z-Image Turbo",
            description: "Ultra-fast 6B text-to-image",
            badge: "new",
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
            path: "/motion-copy",
            label: "Motion Copy",
            description: "Transfer movement patterns",
            badge: "popular",
            iconSrc: "/ai_icons/kling-color.svg",
          },
          {
            path: "/lipsync",
            label: "Lipsync",
            description: "Sync voice with character",
            iconSrc: "/ai_icons/openai.svg",
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
    label: "Assets",
    path: "/assets",
    simpleItems: [
      { path: "/assets", label: "Assets", description: "Store and sort your generated assets", iconSrc: "/window.svg", badge: "new" },
      { path: "/history", label: "History", description: "Past generations and edits", iconSrc: "/file.svg" },
      { path: "/brand", label: "Brand", description: "Manage brand settings", iconSrc: "/logo.svg", badge: "new" },
    ],
  },
  { label: "Canvas", path: "/canvases" },
  { label: "Apps", path: "/apps", badge: "new" },
  { label: "Agent", path: "/chat", badge: "new" },
  { label: "Pricing", path: "/pricing" },
]

/**
 * Dashboard quick-action tools.
 * Keep this alongside navigation constants so dashboard and nav stay aligned.
 */
export const dashboardToolNavItems: DashboardToolNavItem[] = [
  {
    label: "Brand kit",
    href: "/brand",
    icon: "palette",
    hint: "Logos, colors, type, and voice for consistent AI output.",
  },
  {
    label: "Motion Copy",
    href: "/motion-copy",
    icon: "flow-arrow",
    hint: "Copy motion from ads or dance clips onto your character-animate a still with prompts.",
  },
  {
    label: "Lip Sync",
    href: "/lipsync",
    icon: "microphone",
    hint: "Sync speech to a face in an image or clip.",
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
    label: "Agent",
    href: "/chat",
    icon: "chat-circle-dots",
    hint: "Open AI chat to plan and create faster.",
  },
]
