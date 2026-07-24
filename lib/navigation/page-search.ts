import {
  megaNavGroups,
  type MegaNavBadge,
  type MegaNavGroup,
  type MegaNavItem,
  type MegaNavPhosphorIcon,
} from "@/lib/constants/navigation"
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/lib/profile/settings-tabs"

export type PageSearchSettingsTab = SettingsTab

export interface PageSearchItem {
  id: string
  label: string
  description: string
  path: string
  group: string
  badge?: MegaNavBadge
  iconSrc?: string
  iconText?: string
  iconPhosphor?: MegaNavPhosphorIcon
  /** When set, selecting this row opens the profile settings modal on that tab */
  settingsTab?: PageSearchSettingsTab
  searchText: string
}

function isAppPath(path: string) {
  return path === "/apps" || path.startsWith("/apps/")
}

function pathSearchTerms(path: string) {
  const terms = [path]
  const segments = path
    .split(/[/?#&=]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const segment of segments) {
    terms.push(segment)
    if (segment.endsWith("s") && segment.length > 3) {
      terms.push(segment.slice(0, -1))
    }
  }

  return terms
}

function buildSearchText(
  parts: Array<string | string[] | undefined>,
  path?: string,
) {
  const values = parts
    .flatMap((part) => (Array.isArray(part) ? part : part ? [part] : []))
    .map((part) => part.trim())
    .filter(Boolean)

  if (path) values.push(...pathSearchTerms(path))

  return [...new Set(values.map((value) => value.toLowerCase()))].join(" ")
}

function hasMenuItemAtPath(group: MegaNavGroup, path: string) {
  if (group.simpleItems?.some((item) => item.path === path)) return true
  return (
    group.sections?.some(
      (section) =>
        section.title === "Features" && section.items.some((item) => item.path === path),
    ) ?? false
  )
}

function routeIconText(item: Pick<MegaNavItem, "iconText" | "iconSrc" | "iconPhosphor">) {
  if (item.iconText) return item.iconText
  if (item.iconSrc || item.iconPhosphor) return undefined
  return "/"
}

function itemToSearchItem(item: MegaNavItem, group: string): PageSearchItem | null {
  if (isAppPath(item.path)) return null

  return {
    id: `${group}:${item.label}:${item.path}`,
    label: item.label,
    description: item.description,
    path: item.path,
    group,
    badge: item.badge,
    iconSrc: item.iconSrc,
    iconText: routeIconText(item),
    iconPhosphor: item.iconPhosphor,
    searchText: buildSearchText(
      [item.label, item.description, group, item.searchKeywords],
      item.path,
    ),
  }
}

function getSearchRank(item: PageSearchItem, query: string) {
  const label = item.label.toLowerCase()
  const description = item.description.toLowerCase()
  const path = item.path.toLowerCase()
  const terms = item.searchText.split(" ").filter(Boolean)

  if (label === query) return 0
  if (label.startsWith(query)) return 1
  if (terms.some((term) => term.startsWith(query))) return 2
  if (label.includes(query)) return 3
  if (description.startsWith(query)) return 4
  if (description.includes(query)) return 5
  if (path.includes(query)) return 6
  if (item.searchText.includes(query)) return 7
  return Number.POSITIVE_INFINITY
}

function getSettingsSearchItems(): PageSearchItem[] {
  return SETTINGS_TABS.map((item) => ({
    id: `settings:${item.id}`,
    label: item.label,
    description: item.description,
    path: `settings:${item.id}`,
    group: "Settings",
    iconSrc: item.iconSrc,
    settingsTab: item.id,
    searchText: buildSearchText([
      item.label,
      item.description,
      "settings",
      "profile",
      item.id,
      item.searchKeywords,
    ]),
  }))
}

export function getCorePageSearchItems(options?: {
  includeSettings?: boolean
}): PageSearchItem[] {
  const items: PageSearchItem[] = []
  const seen = new Set<string>()

  function push(item: PageSearchItem | null) {
    if (!item) return
    const key = `${item.label}:${item.path}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  for (const group of megaNavGroups) {
    if (group.path && !isAppPath(group.path) && !hasMenuItemAtPath(group, group.path)) {
      const matchingMenuItem =
        group.simpleItems?.find((item) => item.path === group.path && item.label === group.label) ??
        group.simpleItems?.find((item) => item.path === group.path)

      push(
        matchingMenuItem
          ? itemToSearchItem(matchingMenuItem, group.label)
          : {
              id: `${group.label}:${group.path}`,
              label: group.label,
              description: `Open ${group.label}`,
              path: group.path,
              group: group.label,
              badge: group.badge,
              iconSrc: group.iconSrc,
              iconPhosphor: group.iconPhosphor,
              iconText:
                group.iconSrc || group.iconPhosphor
                  ? undefined
                  : "/",
              searchText: buildSearchText([group.label], group.path),
            },
      )
    }

    for (const item of group.simpleItems ?? []) {
      push(itemToSearchItem(item, group.label))
    }

    for (const section of group.sections ?? []) {
      if (section.title !== "Features") continue
      for (const item of section.items) {
        push(itemToSearchItem(item, group.label))
      }
    }
  }

  if (options?.includeSettings) {
    for (const item of getSettingsSearchItems()) {
      push(item)
    }
  }

  return items
}

export function searchCorePages(
  query: string,
  options?: {
    limit?: number
    includeSettings?: boolean
  },
): PageSearchItem[] {
  const q = query.trim().toLowerCase()
  const pages = getCorePageSearchItems({
    includeSettings: options?.includeSettings,
  })
  const ranked = !q
    ? pages
    : pages
        .map((item) => ({ item, rank: getSearchRank(item, q) }))
        .filter(({ rank }) => Number.isFinite(rank))
        .sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank
          return a.item.label.localeCompare(b.item.label)
        })
        .map(({ item }) => item)

  if (options?.limit != null) return ranked.slice(0, options.limit)
  return ranked
}
