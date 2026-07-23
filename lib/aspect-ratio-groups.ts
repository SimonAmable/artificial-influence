export type AspectRatioCategory = "auto" | "square" | "horizontal" | "vertical" | "other"

/** Common aspect ratios shown in the prompt UI (excludes niche phone/cinema sizes). */
export const ESSENTIAL_ASPECT_RATIO_UI_ORDER = [
  "match_input_image",
  "auto",
  "1:1",
  "16:9",
  "4:3",
  "3:2",
  "9:16",
  "4:5",
  "3:4",
  "2:3",
] as const

const ESSENTIAL_ASPECT_RATIO_SET = new Set<string>(ESSENTIAL_ASPECT_RATIO_UI_ORDER)

const GROUP_ORDER: { category: AspectRatioCategory; label: string }[] = [
  { category: "auto", label: "Auto" },
  { category: "square", label: "Square" },
  { category: "horizontal", label: "Horizontal" },
  { category: "vertical", label: "Vertical" },
  { category: "other", label: "Other" },
]

function isAutoAspectRatio(ratio: string): boolean {
  return ratio === "auto" || ratio === "match_input_image"
}

function essentialOrderIndex(ratio: string): number {
  const index = ESSENTIAL_ASPECT_RATIO_UI_ORDER.indexOf(
    ratio as (typeof ESSENTIAL_ASPECT_RATIO_UI_ORDER)[number],
  )
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

/** Keep only common ratios the model supports, in a stable display order. */
export function filterToEssentialAspectRatios(supportedRatios: string[]): string[] {
  const supported = new Set(supportedRatios)
  const filtered: string[] = []
  let hasAutoOption = false

  for (const ratio of ESSENTIAL_ASPECT_RATIO_UI_ORDER) {
    if (!supported.has(ratio)) {
      continue
    }

    if (isAutoAspectRatio(ratio)) {
      if (hasAutoOption) {
        continue
      }
      hasAutoOption = true
    }

    filtered.push(ratio)
  }

  return filtered
}

export function isEssentialAspectRatio(ratio: string): boolean {
  return ESSENTIAL_ASPECT_RATIO_SET.has(ratio)
}

export function resolveDisplayAspectRatio(
  value: string | undefined,
  displayableRatios: string[],
): string {
  if (displayableRatios.length === 0) {
    return ""
  }

  if (value && displayableRatios.includes(value)) {
    return value
  }

  return displayableRatios[0]
}

export function getAspectRatioCategory(ratio: string): AspectRatioCategory {
  if (ratio === "auto" || ratio === "match_input_image") {
    return "auto"
  }

  const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) {
    return "other"
  }

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "other"
  }

  if (width === height) {
    return "square"
  }

  return width > height ? "horizontal" : "vertical"
}

export function groupAspectRatios(ratios: string[]): { label: string; ratios: string[] }[] {
  const buckets = new Map<AspectRatioCategory, string[]>()

  for (const ratio of ratios) {
    const category = getAspectRatioCategory(ratio)
    const existing = buckets.get(category) ?? []
    existing.push(ratio)
    buckets.set(category, existing)
  }

  return GROUP_ORDER.flatMap(({ category, label }) => {
    const groupRatios = buckets.get(category)
    if (!groupRatios?.length) {
      return []
    }

    const sortedRatios = [...groupRatios].sort(
      (left, right) => essentialOrderIndex(left) - essentialOrderIndex(right),
    )

    return [{ label, ratios: sortedRatios }]
  })
}
