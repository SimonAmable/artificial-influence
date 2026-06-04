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

/** Legacy layout character once used after @mentions. New mentions no longer insert it. */
export const MENTION_NBSP = "\u00A0"
export const MENTION_TAIL_NBSP_COUNT = 0
/** Max consecutive NBSP consumed after a token when parsing (allows manual edits). */
export const MENTION_NBSP_MAX_RUN = 16

export function mentionReserveTail(): string {
  return ""
}

/** End index after token + optional legacy layout NBSP run. */
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
