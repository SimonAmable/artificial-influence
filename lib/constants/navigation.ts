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

const baseNavigationItems: NavigationItem[] = [
  { path: "/", label: "Home" },
  { path: "/canvases", label: "Canvas" },
  { path: "/image", label: "Image" },
  { path: "/video", label: "Video" },
  { path: "/influencer-generator", label: "Image Editing" },
  { path: "/character-swap", label: "Character Swap" },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
  { path: "/assets", label: "Assets" },
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
