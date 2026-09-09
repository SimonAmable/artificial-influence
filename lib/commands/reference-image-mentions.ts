/** True when `token` appears as its own cite, not as a prefix of a longer one. */
export function promptContainsMentionToken(prompt: string, token: string): boolean {
  if (!token) return false
  let from = 0
  while (from < prompt.length) {
    const start = prompt.indexOf(token, from)
    if (start === -1) return false
    const next = prompt[start + token.length]
    if (!next || !/[A-Za-z0-9-]/.test(next)) return true
    from = start + token.length
  }
  return false
}

/** Positional cite for an already-attached reference image, e.g. `@image1`. */
export function referenceImageMentionToken(index: number): string {
  return `@image${index + 1}`
}

export type MentionTokenReplacement = {
  from: string
  to: string
}

/**
 * Rewrite mention tokens without substring collisions (`@image1` vs `@image10`).
 * Empty `to` removes the token.
 */
export function replaceMentionTokens(
  text: string,
  replacements: ReadonlyArray<MentionTokenReplacement>,
): string {
  const unique = replacements.filter((pair) => pair.from.length > 0 && pair.from !== pair.to)
  if (unique.length === 0 || !text) return text

  const byLength = [...unique].sort((a, b) => b.from.length - a.from.length)
  const placeholders = byLength.map((_, index) => `\uE000${index}\uE001`)
  let next = text
  byLength.forEach((pair, index) => {
    next = next.split(pair.from).join(placeholders[index] ?? pair.from)
  })
  byLength.forEach((pair, index) => {
    next = next.split(placeholders[index] ?? "").join(pair.to)
  })
  return next
}

/** Keep `@imageN` pointed at the same image after a reorder. */
export function remapReferenceImageMentions(
  prompt: string,
  previousTokensByKey: ReadonlyMap<string, string>,
  nextKeys: readonly string[],
): string {
  const replacements: MentionTokenReplacement[] = []
  nextKeys.forEach((key, index) => {
    const from = previousTokensByKey.get(key)
    if (!from) return
    replacements.push({ from, to: referenceImageMentionToken(index) })
  })
  return replaceMentionTokens(prompt, replacements)
}

/** Drop a slot and shift later `@imageN` tokens down so they follow the images. */
export function mentionsAfterRemovingReference(
  prompt: string,
  removedIndex: number,
  previousCount: number,
): string {
  if (removedIndex < 0 || removedIndex >= previousCount) return prompt
  const replacements: MentionTokenReplacement[] = [
    { from: referenceImageMentionToken(removedIndex), to: "" },
  ]
  for (let index = removedIndex + 1; index < previousCount; index += 1) {
    replacements.push({
      from: referenceImageMentionToken(index),
      to: referenceImageMentionToken(index - 1),
    })
  }
  return replaceMentionTokens(prompt, replacements)
}

export function insertMentionToken(value: string, start: number, end: number, token: string): {
  next: string
  cursor: number
} {
  const before = value.slice(0, start)
  const after = value.slice(end)
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before)
  const needsTrailingSpace = !/^\s/.test(after)
  const insert = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`
  const next = before + insert + after
  return { next, cursor: before.length + insert.length }
}
