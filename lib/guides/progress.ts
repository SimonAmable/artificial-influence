export const GUIDE_PROGRESS_STORAGE_KEY = "unican-guides-completed"
export const GUIDE_PROGRESS_EVENT = "unican-guide-progress"

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

function parseCompleted(raw: string | null): string[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
  } catch {
    return []
  }
}

export function readCompletedGuides(): string[] {
  if (!isBrowser()) return []
  return parseCompleted(window.localStorage.getItem(GUIDE_PROGRESS_STORAGE_KEY))
}

export function markGuideComplete(slug: string): string[] {
  if (!isBrowser() || !slug) return readCompletedGuides()

  const current = readCompletedGuides()
  if (current.includes(slug)) return current

  const next = [...current, slug]
  window.localStorage.setItem(GUIDE_PROGRESS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(GUIDE_PROGRESS_EVENT))
  return next
}

export function isGuideComplete(slug: string, completed: ReadonlySet<string> | string[]): boolean {
  if (Array.isArray(completed)) return completed.includes(slug)
  return completed.has(slug)
}
