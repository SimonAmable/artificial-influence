import {
  megaNavGroups,
  type MegaNavBadge,
  type MegaNavItem,
  type MegaNavPhosphorIcon,
} from "@/lib/constants/navigation"

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
  searchText: string
}

function isAppPath(path: string) {
  return path === "/apps" || path.startsWith("/apps/")
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
    iconText: item.iconText,
    iconPhosphor: item.iconPhosphor,
    searchText: [item.label, item.description, item.path, group]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }
}

export function getCorePageSearchItems(): PageSearchItem[] {
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
    if (group.path && !isAppPath(group.path)) {
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
              searchText: [group.label, group.path].join(" ").toLowerCase(),
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

  return items
}

export function searchCorePages(query: string, limit = 12): PageSearchItem[] {
  const q = query.trim().toLowerCase()
  const pages = getCorePageSearchItems()
  if (!q) return pages.slice(0, limit)

  return pages
    .filter((item) => item.searchText.includes(q))
    .sort((a, b) => {
      const aLabel = a.label.toLowerCase()
      const bLabel = b.label.toLowerCase()
      const aStarts = aLabel.startsWith(q) ? 0 : 1
      const bStarts = bLabel.startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return aLabel.localeCompare(bLabel)
    })
    .slice(0, limit)
}
