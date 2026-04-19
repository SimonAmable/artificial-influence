/**
 * Pull literal colors from raw HTML (inline & <style> blocks); no extra network.
 * Returns normalized #RRGGBB values, deduped, order preserved.
 */

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex6(r: number, g: number, b: number): string {
  const h = (x: number) => clamp255(x).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

/** Normalize #RGB / #RRGGBB to #RRGGBB uppercase. */
export function normalizeHexColor(input: string): string | null {
  let s = input.trim()
  if (!s.startsWith("#")) s = `#${s}`
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toUpperCase()
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1]!
    const g = s[2]!
    const b = s[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return null
}

/** Parse rgb()/rgba() substring to #RRGGBB (ignores alpha). */
export function parseRgbToHex(fragment: string): string | null {
  const m = fragment.match(
    /rgba?\(\s*([\d.]+)(%?)\s*,\s*([\d.]+)(%?)\s*,\s*([\d.]+)(%?)/i,
  )
  if (!m) return null
  const parse = (v: string, isPct: string) => {
    const n = parseFloat(v)
    if (Number.isNaN(n)) return 0
    return isPct === "%" ? (n / 100) * 255 : n
  }
  const r = parse(m[1]!, m[2]!)
  const g = parse(m[3]!, m[4]!)
  const b = parse(m[5]!, m[6]!)
  return toHex6(r, g, b)
}

/** Parse meta theme-color: hex, rgb(), or named (returns null if unsupported). */
export function parseThemeColorMeta(content: string | null | undefined): string | null {
  if (!content?.trim()) return null
  const t = content.trim()
  if (/^#?[0-9A-Fa-f]{3,8}$/i.test(t)) {
    return normalizeHexColor(t.startsWith("#") ? t : `#${t}`)
  }
  if (/^rgba?\(/i.test(t)) {
    return parseRgbToHex(t)
  }
  return null
}

const MAX_COLORS = 32

/** Strong signal for design-token variables (shadcn, custom themes, DS). */
const BRANDISH_VAR = /brand|primary|accent|theme/i

/**
 * Tailwind / default palette variable names like --color-red-500, --color-orange-50.
 * Including those floods the list with unrelated utility colors.
 */
const TAILWIND_PALETTE_VAR =
  /(?:^|[-])(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\b|$)/i

/** Broader semantic hints; still excludes TAILWIND_PALETTE_VAR via isLikelyDesignTokenVar. */
const SEMANTIC_VAR_HINT =
  /(?:^|[-])(?:brand|primary|secondary|accent|theme|foreground|background|muted|destructive|ring|border|card|popover|surface|chart|sidebar|link|heading|body|text|logo|main|canvas|inverse|selection|placeholder|focus|stroke|fill|icon|overlay|elevated|base|subtle|emphasis|highlight|ink|paint|header|footer|nav|menu|action|danger|success|warning|info|button|input|label|title|subtitle|caption|display|prose)(?:\b|[-_])/i

function isLikelyDesignTokenVar(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  if (TAILWIND_PALETTE_VAR.test(n)) return false
  if (SEMANTIC_VAR_HINT.test(n)) return true
  if (/^color-(?!red-|orange-|amber-|yellow-|lime-|green-|emerald-|teal-|cyan-|sky-|blue-|indigo-|violet-|purple-|fuchsia-|pink-|rose-|slate-|gray-|grey-|zinc-|neutral-|stone-)/i.test(
    n,
  ))
    return true
  return false
}

function pushColor(
  hex: string | null,
  highPriority: boolean,
  seen: Set<string>,
  priority: string[],
  rest: string[],
): void {
  if (!hex || seen.has(hex)) return
  seen.add(hex)
  if (highPriority) priority.push(hex)
  else rest.push(hex)
}

/**
 * Extract colors from CSS custom properties only (no global hex scan).
 * Full-stylesheet hex/rgb scans pull entire Tailwind palettes and third-party widgets.
 * Only `--name: #hex|rgb()` where `name` looks like a design token, not e.g. `--color-red-500`.
 */
export function extractColorsFromCssText(css: string): string[] {
  const seen = new Set<string>()
  const priority: string[] = []
  const rest: string[] = []

  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}\n]+)/g)) {
    if (priority.length + rest.length >= MAX_COLORS) break
    const name = m[1] ?? ""
    if (!isLikelyDesignTokenVar(name)) continue

    const raw = (m[2] ?? "")
      .trim()
      .replace(/\s*!important\s*$/i, "")
      .trim()
    if (!raw || raw.startsWith("var(")) continue

    let hex: string | null = null
    if (raw.startsWith("#")) {
      const token = raw.split(/[\s,]/)[0] ?? raw
      hex = normalizeHexColor(token)
    } else if (/^rgba?\(/i.test(raw)) {
      hex = parseRgbToHex(raw)
    }
    if (hex) pushColor(hex, BRANDISH_VAR.test(name), seen, priority, rest)
  }

  return [...priority, ...rest].slice(0, MAX_COLORS)
}

function mergeDedupedLists(lists: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const c of list) {
      if (out.length >= MAX_COLORS) return out
      if (seen.has(c)) continue
      seen.add(c)
      out.push(c)
    }
  }
  return out
}

/**
 * Colors from `<style>` and inline `style=""` only; not raw HTML (SVG, ads, JSON).
 * `<style>` may contain a full Tailwind build: only semantic custom properties there.
 * Arbitrary `#hex` / `rgb()` is limited to **inline attributes** (short, usually intentional).
 */
export function extractColorLiteralsFromHtml(html: string): string[] {
  let styleTagCss = ""
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = styleRe.exec(html)) !== null) {
    styleTagCss += `\n${m[1]}`
  }

  let inlineAttrCss = ""
  const attrRe = /style\s*=\s*["']([^"']*)["']/gi
  while ((m = attrRe.exec(html)) !== null) {
    inlineAttrCss += `\n${m[1]}`
  }

  const fromStyleTags = extractColorsFromCssText(styleTagCss)
  const fromInlineSemantic = extractColorsFromCssText(inlineAttrCss)

  const inlineLiterals: string[] = []
  const seenInline = new Set<string>()
  const pushInline = (hex: string | null) => {
    if (!hex || seenInline.has(hex)) return
    seenInline.add(hex)
    inlineLiterals.push(hex)
  }
  for (const match of inlineAttrCss.matchAll(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/gi)) {
    if (inlineLiterals.length >= MAX_COLORS) break
    pushInline(normalizeHexColor(`#${match[1]}`))
  }
  for (const match of inlineAttrCss.matchAll(/rgba?\([^)]*\)/gi)) {
    if (inlineLiterals.length >= MAX_COLORS) break
    pushInline(parseRgbToHex(match[0]))
  }

  return mergeDedupedLists([fromStyleTags, fromInlineSemantic, inlineLiterals])
}

/** Merge color lists: theme first, then linked CSS, then inline HTML. Dedup, cap 32. */
export function mergeColorCandidateLists(
  themeHint: string | null,
  fromStylesheets: string[],
  fromHtml: string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (c: string) => {
    if (seen.has(c)) return
    seen.add(c)
    out.push(c)
  }
  if (themeHint) add(themeHint)
  for (const c of fromStylesheets) add(c)
  for (const c of fromHtml) add(c)
  return out.slice(0, MAX_COLORS)
}
