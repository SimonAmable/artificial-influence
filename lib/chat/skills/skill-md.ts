import matter from "gray-matter"

/** Matches DB check `skills_slug_format_check`. */
export const SKILL_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Catalog / frontmatter blurb cap (agentskills default is 1024; UniCan allows longer Cursor-native skills). */
export const MAX_SKILL_DESCRIPTION_LENGTH = 2048
export const MAX_SKILL_BODY_CHARS = 120_000
export const MAX_SKILL_SLUG_LENGTH = 64

export type ParsedSkillDocument = {
  name: string
  description: string
  body: string
}

export function isValidSkillSlug(slug: string) {
  return (
    slug.length >= 1 &&
    slug.length <= MAX_SKILL_SLUG_LENGTH &&
    SKILL_SLUG_REGEX.test(slug)
  )
}

export function parseSkillDocument(raw: string): ParsedSkillDocument {
  const { data, content } = matter(raw)
  const dataRecord = data as Record<string, unknown>
  const name = typeof dataRecord.name === "string" ? dataRecord.name : ""
  const description =
    typeof dataRecord.description === "string" ? dataRecord.description : ""

  return {
    name,
    description,
    body: content.trim(),
  }
}

export function buildSkillDocument(slug: string, description: string, body: string) {
  const trimmed = body.trim()
  const text = trimmed.length > 0 ? `${trimmed}\n` : "\n"
  return matter.stringify(text, {
    name: slug,
    description,
  })
}
