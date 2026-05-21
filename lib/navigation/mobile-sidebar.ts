import {
  megaNavGroups,
  navigationItems,
  type MegaNavGroup,
} from "@/lib/constants/navigation"

/** Whether `pathname` + current search matches a mega link that may include query. */
export function megaNavPathMatches(
  pathname: string,
  currentSearch: string,
  targetHref: string,
): boolean {
  const q = targetHref.indexOf("?")
  const base = q >= 0 ? targetHref.slice(0, q) : targetHref
  if (pathname !== base) return false
  if (q < 0) return true
  const want = new URLSearchParams(targetHref.slice(q + 1))
  const have = new URLSearchParams(currentSearch)
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false
  }
  return true
}

export function isMegaGroupActiveForPath(pathname: string, group: MegaNavGroup): boolean {
  if (group.path && pathname === group.path.split("?")[0]) return true
  const items = [
    ...(group.simpleItems ?? []),
    ...((group.sections ?? []).flatMap((s) => s.items)),
  ]
  return items.some((item) => pathname === item.path.split("?")[0])
}

export function getMobileNavTriggerLabel(
  pathname: string,
  search: string,
  authenticated: boolean,
): string {
  if (pathname === "/") return authenticated ? "Agent" : "Home"
  for (const group of megaNavGroups) {
    const allItems = [
      ...(group.simpleItems ?? []),
      ...((group.sections ?? []).flatMap((s) => s.items)),
    ]
    for (const item of allItems) {
      if (megaNavPathMatches(pathname, search, item.path)) return item.label
    }
  }
  for (const group of megaNavGroups) {
    if (group.path && megaNavPathMatches(pathname, search, group.path)) {
      return group.label
    }
  }
  const nav = navigationItems.find((i) => i.path === pathname)
  return nav?.label ?? "Tools"
}

export function isPageInMegaNavigation(
  pathname: string,
  search: string,
  authenticated: boolean,
): boolean {
  if (pathname === "/") return true
  return getMobileNavTriggerLabel(pathname, search, authenticated) !== "Tools"
}

/** Groups that should start collapsed on mobile unless the current route is inside them. */
export const MOBILE_COLLAPSIBLE_GROUP_LABELS = new Set([
  "Image",
  "Video",
  "Assets",
  "Free Tools",
])

export function isStandaloneMegaGroup(group: MegaNavGroup): boolean {
  return Boolean(group.path && !group.sections?.length && !group.simpleItems?.length)
}
