/** Resolve which timeline track row is under the pointer (for cross-track moves). */
export function trackIdAtPointer(
  clientX: number,
  clientY: number,
  fallbackTrackId: string
): string {
  const stack = document.elementsFromPoint(clientX, clientY)
  for (const el of stack) {
    if (el instanceof HTMLElement) {
      const row = el.closest("[data-timeline-track]")
      const id = row?.getAttribute("data-timeline-track")
      if (id) return id
    }
  }
  return fallbackTrackId
}
