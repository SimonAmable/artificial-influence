import {
  GENJUTSU_MAX_SECONDS,
  GENJUTSU_MIN_SECONDS,
  VIRAL_CLONER_IMAGE_CREDITS,
  VIRAL_CLONER_IMPORT_CREDIT,
  VIRAL_CLONER_VIDEO_CREDITS_PER_SECOND,
} from "./constants"
import type { ViralClonerTrimSelection } from "./types"

export function resolveGenjutsuBillableSeconds(
  durationSeconds: number | null,
  trim?: ViralClonerTrimSelection | null,
): number {
  if (trim) {
    const span = trim.endSeconds - trim.startSeconds
    if (span < GENJUTSU_MIN_SECONDS || span > GENJUTSU_MAX_SECONDS) {
      throw new Error(`Clip length must be between ${GENJUTSU_MIN_SECONDS} and ${GENJUTSU_MAX_SECONDS} seconds.`)
    }
    return span
  }
  const duration = durationSeconds ?? GENJUTSU_MAX_SECONDS
  if (duration > GENJUTSU_MAX_SECONDS) {
    throw new Error("Trim this clip before cloning — sources longer than 15 seconds need a trim selection.")
  }
  if (duration < GENJUTSU_MIN_SECONDS) {
    throw new Error(`Video must be at least ${GENJUTSU_MIN_SECONDS} seconds.`)
  }
  return duration
}

export type ViralCloneQuoteLine = {
  index: number
  kind: "image" | "video" | "animated"
  credits: number
  billableSeconds?: number
}

export type ViralCloneQuote = {
  lines: ViralCloneQuoteLine[]
  itemCredits: number
  importCredit: number
  totalCredits: number
}

export function quoteViralCloneSelection(input: {
  items: Array<{ index: number; kind: "image" | "video" | "animated"; durationSeconds: number | null }>
  selectedIndexes: number[]
  trims: Record<number, ViralClonerTrimSelection>
  includeImportFee: boolean
}): ViralCloneQuote {
  const selected = new Set(input.selectedIndexes)
  const lines: ViralCloneQuoteLine[] = []

  for (const item of input.items) {
    if (!selected.has(item.index)) continue
    if (item.kind === "image") {
      lines.push({ index: item.index, kind: item.kind, credits: VIRAL_CLONER_IMAGE_CREDITS })
      continue
    }
    const billableSeconds = resolveGenjutsuBillableSeconds(item.durationSeconds, input.trims[item.index] ?? null)
    lines.push({
      index: item.index,
      kind: item.kind,
      credits: billableSeconds * VIRAL_CLONER_VIDEO_CREDITS_PER_SECOND,
      billableSeconds,
    })
  }

  if (lines.length === 0) {
    throw new Error("Select at least one media item to clone.")
  }

  const itemCredits = lines.reduce((sum, line) => sum + line.credits, 0)
  const importCredit = input.includeImportFee ? VIRAL_CLONER_IMPORT_CREDIT : 0

  return {
    lines,
    itemCredits,
    importCredit,
    totalCredits: itemCredits + importCredit,
  }
}