import type { AttachedRef } from "./types"
import { extendMentionRangeEnd } from "./mention-token"

export type MentionPart =
  | { type: "text"; text: string; key: string }
  | {
      type: "mention"
      ref: AttachedRef
      token: string
      key: string
      start: number
      end: number
    }

/**
 * Split prompt value into plain text runs and @mention segments (token + trailing layout NBSP).
 */
export function valueToParts(value: string, refs: AttachedRef[]): MentionPart[] {
  const withToken = refs.filter((r) => r.mentionToken.length > 0)
  if (withToken.length === 0 || !value) {
    return value ? [{ type: "text", text: value, key: "t0" }] : []
  }
  const tokens = [...new Set(withToken.map((r) => r.mentionToken))].sort((a, b) => b.length - a.length)
  const refByToken = new Map(withToken.map((r) => [r.mentionToken, r]))
  const parts: MentionPart[] = []
  let i = 0
  let k = 0
  let buf = ""
  const flush = () => {
    if (buf) {
      parts.push({ type: "text", text: buf, key: `t${k++}` })
      buf = ""
    }
  }
  while (i < value.length) {
    let matched: string | null = null
    for (const tok of tokens) {
      if (value.startsWith(tok, i)) {
        matched = tok
        break
      }
    }
    if (matched) {
      flush()
      const start = i
      const end = extendMentionRangeEnd(value, start, matched.length)
      parts.push({
        type: "mention",
        ref: refByToken.get(matched)!,
        token: matched,
        key: `m${k++}-${start}`,
        start,
        end,
      })
      i = end
    } else {
      buf += value[i]
      i += 1
    }
  }
  flush()
  return parts
}
