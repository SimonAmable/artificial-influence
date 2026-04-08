import type { AttachedRef } from "./types"
import { stripMentionLayoutChars } from "./mention-token"

/**
 * Merges the user's textarea with @-reference chips into one string for APIs.
 * References are appended as a labeled context block after the main text.
 */
export function buildPromptWithRefs(text: string, refs: AttachedRef[]): string {
  const base = stripMentionLayoutChars(text).trim()
  if (refs.length === 0) return base
  const contextBlock = refs.map((r) => r.serialized.trim()).filter(Boolean).join("\n\n---\n\n")
  if (!base) return `Context:\n${contextBlock}`
  return `${base}\n\nContext:\n${contextBlock}`
}
