/** Opacity for group shell fill (Tailwind-style /80). */
const GROUP_SHELL_ALPHA = 0.8

/**
 * Applies fixed alpha to a CSS color for the group background (hex, rgb, or rgba).
 * Transparent / clear sentinel stays transparent.
 */
export function applyGroupShellOpacity(cssColor: string): string {
  if (cssColor === "transparent") return "transparent"
  const trimmed = cssColor.trim()
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
  )
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number(rgbMatch[1])))
    const g = Math.min(255, Math.max(0, Number(rgbMatch[2])))
    const b = Math.min(255, Math.max(0, Number(rgbMatch[3])))
    return `rgba(${r}, ${g}, ${b}, ${GROUP_SHELL_ALPHA})`
  }
  if (trimmed.startsWith("#")) {
    let h = trimmed.slice(1)
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("")
    }
    if (h.length === 8) h = h.slice(0, 6)
    if (h.length !== 6) {
      return `color-mix(in srgb, ${trimmed} ${GROUP_SHELL_ALPHA * 100}%, transparent)`
    }
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return `color-mix(in srgb, ${trimmed} ${GROUP_SHELL_ALPHA * 100}%, transparent)`
    }
    return `rgba(${r}, ${g}, ${b}, ${GROUP_SHELL_ALPHA})`
  }
  return `color-mix(in srgb, ${trimmed} ${GROUP_SHELL_ALPHA * 100}%, transparent)`
}
