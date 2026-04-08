import type { ReferenceItem } from "./types"

/** Slug used after @ (single token, no spaces) */
export function slugifyMentionLabel(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return s || "ref"
}

/**
 * Builds a unique @token substring for the prompt (visible to the model and for inline chip rendering).
 * Uniqueness is enforced against existing ref tokens only (substring collisions like @foo vs @foo1 are handled when rendering).
 */
export function makeMentionToken(
  item: ReferenceItem,
  takenTokens: ReadonlySet<string>
): string {
  const base = slugifyMentionLabel(item.label)
  let candidate = `@${base}`
  let n = 0
  while (takenTokens.has(candidate)) {
    n += 1
    candidate = `@${base}${n}`
  }
  return candidate
}

/** Non-breaking spaces inserted after each @mention so the textarea width matches the pill + remove control. */
export const MENTION_NBSP = "\u00A0"
/** How many NBSP we append after each @token so the mirror width matches the textarea (minimal tail now that remove control sits over the leading @). */
export const MENTION_TAIL_NBSP_COUNT = 2
/** Max consecutive NBSP consumed after a token when parsing (allows manual edits). */
export const MENTION_NBSP_MAX_RUN = 16

export function mentionReserveTail(): string {
  return MENTION_NBSP.repeat(MENTION_TAIL_NBSP_COUNT)
}

/** End index after token + optional layout NBSP run (same chars we insert after the @token). */
export function extendMentionRangeEnd(value: string, tokenStart: number, tokenLen: number): number {
  let end = tokenStart + tokenLen
  let n = 0
  while (end < value.length && value[end] === MENTION_NBSP && n < MENTION_NBSP_MAX_RUN) {
    end += 1
    n += 1
  }
  return end
}

/** Remove layout NBSP before sending prompt to models / APIs (keeps visible @token text only). */
export function stripMentionLayoutChars(text: string): string {
  return text.replace(/\u00A0/g, "")
}
