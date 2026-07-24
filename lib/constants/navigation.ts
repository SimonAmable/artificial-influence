/**
 * Shared navigation items for app header and canvas header
 */
import { currentProduct } from "@/lib/product/current"
import { productLogo } from "@/lib/product/branding"
import type { ProductConfig, ProductId } from "@/lib/product/types"
import { isRouteVisibleForProduct, isVisibleByProductMetadata } from "@/lib/product/visibility"

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
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

export type MegaNavBadge = "new" | "popular" | "beta"

/** Phosphor icons for feature rows, clearer than generic brand SVGs for create/edit flows */
export type MegaNavPhosphorIcon =
  | "folder"
  | "image"
  | "video"
  | "paint-brush"
  | "film-strip"
  | "flow-arrow"
  | "microphone"
  | "chat-circle-dots"
  | "robot"
  | "user"
  | "smiley"
  | "paper-plane-tilt"
  | "shield-check"
  | "magnifying-glass"
  | "download-simple"
  | "squares-four"
  | "clock-counter-clockwise"
  | "pencil-simple"

export interface MegaNavItem {
  path: string
  label: string
  description: string
  badge?: MegaNavBadge
  iconSrc?: string
  iconText?: string
  /** When set, header renders this Phosphor icon instead of iconSrc */
  iconPhosphor?: MegaNavPhosphorIcon
  /** Extra terms surfaced in global search (aliases, synonyms, path fragments) */
  searchKeywords?: string[]
  /** Replicate-style model id, surfaced on menu items as data-model-identifier */
  modelIdentifier?: string
  products?: ProductId[]
  hiddenFor?: ProductId[]
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
  products?: ProductId[]
  hiddenFor?: ProductId[]
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
  | "user"
  | "smiley"
  | "shield-check"

export interface DashboardToolNavItem {
  label: string
  href: string
  hint: string
  icon: DashboardToolIcon
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

const baseNavigationItems: NavigationItem[] = [
  { path: "/", label: "Home" },
  { path: "/chat", label: "Agent" },
  { path: "/templates", label: "Templates" },
  { path: "/slideshows", label: "Slideshows", hiddenFor: ["presence-studio"] },
  { path: "/content", label: "Content", products: ["presence-studio"] },
  { path: "/autopost", label: "Autopost", hiddenFor: ["presence-studio"] },
  { path: "/image", label: "Image" },
  { path: "/video", label: "Video" },
  { path: "/audio", label: "Audio" },
  { path: "/assets?tab=brands", label: "Brand", hiddenFor: ["presence-studio"] },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
  { path: "/inpaint", label: "Image Editing" },
  { path: "/image?model=custom/character-swap", label: "Character Swap" },
  { path: "/carousel-shots", label: "Carousel Shots" },
  { path: "/image?model=custom/face-swap", label: "Face Swap" },
  { path: "/ai-influencer", label: "AI Influencer" },
  { path: "/canvases", label: "Canvas" },
  { path: "/editor", label: "Editor" },
  { path: "/assets?tab=history", label: "History" },
  { path: "/assets", label: "Library" },
  { path: "/resources", label: "Resources" },
  { path: "/free-tools", label: "Free Tools" },
  { path: "/pricing-test", label: "Pricing (Test)", devOnly: true },
  { path: "/pricing", label: "Pricing" },
]

/**
 * Get navigation items with dynamic styling based on their properties
 * - Test pages (containing "test" in path or label) get yellow styling
 * - Dev-only items are filtered out in production
 */
function itemAllowsProduct(
  item: { products?: ProductId[]; hiddenFor?: ProductId[] },
  productId: ProductId,
) {
  if (item.hiddenFor?.includes(productId)) return false
  if (item.products?.length && !item.products.includes(productId)) return false
  return true
}

export function getNavigationItems(product: ProductConfig = currentProduct): NavigationItem[] {
  const items = baseNavigationItems
    .filter((item) => !item.devOnly || process.env.NODE_ENV === "development")
    .filter((item) => itemAllowsProduct(item, product.id))
    .filter((item) => isRouteVisibleForProduct(item.path, product))
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
const baseMegaNavGroups: MegaNavGroup[] = [
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
      {
        path: "/templates",
        label: "Templates",
        description: "Browse reusable creation workflows and manage your own templates",
        badge: "new",
        iconPhosphor: "flow-arrow",
      },
      {
        path: "/slideshows",
        label: "Slideshows",
        description: "Create repeatable collection and AI-powered image slideshows",
        badge: "new",
        iconPhosphor: "squares-four",
        hiddenFor: ["presence-studio"],
      },
    ],
  },
  // {
  //   label: "Explore",
  //   path: "/explore",
  //   badge: "new",
  // },
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
            path: "/image?model=custom/character-swap",
            label: "Character Swap",
            description: "Create realistic character swaps",
            badge: "new",
            iconSrc: "/users-icon.svg",
          },
          {
            path: "/carousel-shots",
            label: "Carousel Shots",
            description: "Generate multi-shot carousels from one reference",
            badge: "new",
            iconPhosphor: "images",
          },
          {
            path: "/image?model=custom/face-swap",
            label: "Face Swap",
            description: "Transfer facial identity onto a target scene",
            badge: "new",
            iconPhosphor: "smiley",
          },
          {
            path: "/ai-influencer",
            label: "AI Influencer",
            description: "Create and build custom AI characters",
            badge: "new",
            iconPhosphor: "user",
          },
          {
            path: "/inpaint",
            label: "Image Editing",
            description: "Select area and edit",
            iconPhosphor: "paint-brush",
          },
          {
            path: "/upscale",
            label: "Upscale",
            description: "Enhance resolution (1 credit)",
            iconPhosphor: "magnifying-glass",
          },
          {
            path: "/free-tools/metadata-remover",
            label: "Metadata Remover",
            description: "Remove metadata from AI images locally",
            badge: "new",
            iconPhosphor: "shield-check",
          },
          {
            path: "/free-tools/image-compressor",
            label: "Image Compressor",
            description: "Resize and compress images locally",
            badge: "new",
            iconPhosphor: "image",
          },
        ],
      },
      {
        title: "Models",
        items: [
          {
            path: "/image?model=google/nano-banana-2-lite",
            label: "Nano Banana 2 Lite",
            description: "Fast, low-cost Nano Banana generation",
            badge: "new",
            iconSrc: "/ai_icons/gemini-color.svg",
          },
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
            description: "OpenAI image generation with strong prompt following",
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
            path: "/image?model=bytedance/seedream-5-pro",
            label: "Seedream 5.0",
            description: "ByteDance flagship, multilingual text, up to 2K",
            iconSrc: "/ai_icons/bytedance-color.svg",
          },
          {
            path: "/image?model=prunaai/z-image-turbo",
            label: "Z-Image Turbo",
            description: "Ultra-fast 6B text-to-image",
            iconSrc: "/ai_icons/flux.svg",
          },
          {
            path: "/image?model=qwen/qwen-image-edit-plus-lora",
            label: "Qwen Image Edit Plus",
            description: "Qwen image editing with a reference photo",
            badge: "new",
            iconSrc: "/ai_icons/qwen.svg",
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
          {
            path: "/free-tools/tiktok-reference-downloader",
            label: "TikTok reference downloader",
            description: "Fetch an MP4 from a TikTok URL for Motion Control",
            badge: "new",
            iconPhosphor: "download-simple",
          },
          {
            path: "/free-tools/tiktok-trend-search",
            label: "TikTok trend search",
            description: "Search TikTok clips with sorting and timeframe filters",
            badge: "new",
            iconPhosphor: "magnifying-glass",
          },
          {
            path: "/free-tools/tiktok-video-fixer",
            label: "TikTok Video Fixer",
            description: "Repair videos for safer TikTok uploads",
            badge: "new",
            iconPhosphor: "shield-check",
          },
          {
            path: "/free-tools/video-compressor",
            label: "Video Compressor",
            description: "Shrink short clips locally",
            badge: "new",
            iconPhosphor: "video",
          },
        ],
      },
      {
        title: "Models",
        items: [
          {
            path: "/video?model=alibaba/happy-horse/v1.1",
            label: "Happy Horse 1.1",
            description: "Unified text, image, and reference-to-video generation",
            badge: "new",
            iconSrc: "/ai_icons/qwen.svg",
          },
          {
            path: "/video?model=google/gemini-omni-flash",
            label: "Gemini Omni Flash",
            description: "Gemini video from text, image, or references",
            badge: "new",
            iconSrc: "/ai_icons/gemini-color.svg",
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
            label: "Kling Video 3.0",
            description: "Cinematic text and image to video",
            badge: "new",
            iconSrc: "/ai_icons/kling-color.svg",
          },
          {
            path: "/video?model=xai/grok-imagine-video-1.5",
            label: "Grok Imagine Video 1.5",
            description: "Image-to-video with synchronized audio",
            badge: "new",
            iconSrc: "/ai_icons/grok.svg",
          },
        ],
      },
    ],
  },
  {
    label: "Audio",
    path: "/audio",
  },
  {
    label: "Library",
    path: "/assets",
    simpleItems: [
      { path: "/assets", label: "Assets", description: "Store and sort your generated assets", iconPhosphor: "folder", badge: "new" },
      { path: "/assets?tab=history", label: "History", description: "Past generations and edits", iconPhosphor: "clock-counter-clockwise" },
      { path: "/resources", label: "Resources", description: "Search live stock and meme references", iconPhosphor: "image", badge: "new" },
      {
        path: "/assets?tab=brands",
        label: "Brand",
        description: "Manage brand settings",
        iconSrc: productLogo,
        badge: "new",
        hiddenFor: ["presence-studio"],
      },
    ],
  },
  {
    label: "Content",
    path: "/content",
    badge: "new",
    products: ["presence-studio"],
  },
  {
    label: "Autopost",
    path: "/autopost",
    badge: "new",
    hiddenFor: ["presence-studio"],
  },
  {
    label: "Canvas",
    path: "/canvases",
    simpleItems: [
      {
        path: "/canvases",
        label: "Canvas",
        description: "Build node-based workflows and visual pipelines",
        iconPhosphor: "pencil-simple",
        searchKeywords: ["workflow", "workflows", "pipeline", "pipelines", "node", "nodes", "canvases"],
      },
    ],
  },
  {
    label: "Free Tools",
    path: "/free-tools",
    simpleItems: [
      {
        path: "/free-tools",
        label: "Free Tools",
        description: "Browse free browser-based creator utilities",
        iconPhosphor: "shield-check",
      },
      {
        path: "/free-tools/metadata-remover",
        label: "Metadata Remover",
        description: "Clean AI image metadata in your browser",
        badge: "new",
        iconPhosphor: "shield-check",
      },
      {
        path: "/free-tools/image-compressor",
        label: "Image Compressor",
        description: "Resize and compress images locally",
        badge: "new",
        iconPhosphor: "image",
      },
      {
        path: "/free-tools/tiktok-reference-downloader",
        label: "TikTok reference downloader",
        description: "Download a TikTok clip as MP4 for motion transfer",
        badge: "new",
        iconPhosphor: "download-simple",
      },
      {
        path: "/free-tools/tiktok-trend-search",
        label: "TikTok trend search",
        description: "Filter TikTok search by popularity and date",
        badge: "new",
        iconPhosphor: "magnifying-glass",
      },
      {
        path: "/free-tools/tiktok-video-fixer",
        label: "TikTok Video Fixer",
        description: "Repair video format issues for TikTok",
        badge: "new",
        iconPhosphor: "shield-check",
      },
      {
        path: "/free-tools/video-compressor",
        label: "Video Compressor",
        description: "Create smaller WebM clips locally",
        badge: "new",
        iconPhosphor: "video",
      },
    ],
  },
  { label: "Pricing", path: "/pricing" },
]

function filterMegaNavItems(items: MegaNavItem[] | undefined, product: ProductConfig) {
  return (items ?? []).filter(
    (item) =>
      itemAllowsProduct(item, product.id) &&
      isRouteVisibleForProduct(item.path, product),
  )
}

export function getMegaNavGroups(product: ProductConfig = currentProduct): MegaNavGroup[] {
  return baseMegaNavGroups
    .filter((group) => itemAllowsProduct(group, product.id))
    .map((group) => {
      const simpleItems = filterMegaNavItems(group.simpleItems, product)
      const sections = group.sections
        ?.map((section) => ({
          ...section,
          items: filterMegaNavItems(section.items, product),
        }))
        .filter((section) => section.items.length > 0)

      return {
        ...group,
        simpleItems,
        sections,
      }
    })
    .filter((group) => {
      const hasVisiblePath = group.path ? isRouteVisibleForProduct(group.path, product) : false
      return hasVisiblePath || Boolean(group.simpleItems?.length) || Boolean(group.sections?.length)
    })
}

export const megaNavGroups = getMegaNavGroups()

/** Minimal link shape for footer columns (mirrors mega menu). */
export interface FooterMegaNavLink {
  path: string
  label: string
}

/**
 * Footer columns aligned with the desktop mega menu: Image tools, Video tools,
 * Other tools (Agent + Assets + top-level links), and split Image / Video models.
 */
export function getFooterMegaNavColumns(): {
  imageTools: FooterMegaNavLink[]
  videoTools: FooterMegaNavLink[]
  otherTools: FooterMegaNavLink[]
  imageModels: FooterMegaNavLink[]
  videoModels: FooterMegaNavLink[]
  freeTools: FooterMegaNavLink[]
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

  const groups = getMegaNavGroups()
  const imageGroup = groups.find((g) => g.label === "Image")
  const videoGroup = groups.find((g) => g.label === "Video")
  const agentGroup = groups.find((g) => g.label === "Agent")
  const assetsGroup = groups.find((g) => g.label === "Assets")
  const freeToolsGroup = groups.find((g) => g.label === "Free Tools")

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
  const freeTools = toLinks(freeToolsGroup?.simpleItems ?? [])

  const otherTools: FooterMegaNavLink[] = []
  if (agentGroup?.simpleItems?.length) {
    for (const item of agentGroup.simpleItems) {
      otherTools.push({ path: item.path, label: item.label })
    }
  }
  if (assetsGroup?.simpleItems?.length) {
    for (const item of assetsGroup.simpleItems) {
      otherTools.push({ path: item.path, label: item.label })
    }
  }
  for (const g of groups) {
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
    freeTools: dedupeLinks(freeTools),
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
    label: "Templates",
    href: "/templates",
    icon: "flow-arrow",
    hint: "Browse reusable workflows and launch your own template runs.",
  },
  {
    label: "Slideshows",
    href: "/slideshows",
    icon: "squares-four",
    hint: "Create repeatable collection and AI-powered image slideshows.",
    hiddenFor: ["presence-studio"],
  },
  {
    label: "Content",
    href: "/content",
    icon: "palette",
    hint: "Upload Fanvue vault media and schedule posts.",
    products: ["presence-studio"],
  },
  {
    label: "Autopost",
    href: "/autopost",
    icon: "palette",
    hint: "Schedule and publish posts to Instagram and TikTok.",
    hiddenFor: ["presence-studio"],
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
    hiddenFor: ["presence-studio"],
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
    href: "/image?model=custom/character-swap",
    icon: "arrows-left-right",
    hint: "Swap a subject while keeping the scene.",
  },
  {
    label: "Carousel Shots",
    href: "/carousel-shots",
    icon: "images",
    hint: "Generate consistent carousel panels from one reference image.",
  },
  {
    label: "Face Swap",
    href: "/image?model=custom/face-swap",
    icon: "smiley",
    hint: "Transfer facial identity onto a target person or scene.",
  },
  {
    label: "AI Influencer",
    href: "/ai-influencer",
    icon: "user",
    hint: "Create custom AI characters and influencers.",
  },
  {
    label: "Workflow",
    href: "/canvases",
    icon: "pencil-simple",
    hint: "Node-based pipelines and canvas projects.",
  },
  {
    label: "Video Editor",
    href: "/editor",
    icon: "video",
    hint: "Edit and assemble AI videos on a timeline.",
  },
  {
    label: "History",
    href: "/assets?tab=history",
    icon: "pencil-simple",
    hint: "Review past generations and edits.",
  },
  {
    label: "Library",
    href: "/assets",
    icon: "squares-four",
    hint: "Browse saved assets, history, brands, and collections.",
  },
  {
    label: "Resources",
    href: "/resources",
    icon: "image",
    hint: "Search live stock references and meme sources.",
  },
]

export function getDashboardToolNavItems(product: ProductConfig = currentProduct): DashboardToolNavItem[] {
  return dashboardToolNavItems.filter(
    (item) =>
      isVisibleByProductMetadata(item, product.id) &&
      isRouteVisibleForProduct(item.href, product),
  )
}
