import {
  buildSkillDocument,
  isValidSkillSlug,
  MAX_SKILL_BODY_CHARS,
  MAX_SKILL_DESCRIPTION_LENGTH,
  parseSkillDocument,
} from "@/lib/chat/skills/skill-md"

export type NormalizedSkillUpload =
  | { ok: true; skillDocument: string; slug: string; description: string; body: string }
  | { ok: false; error: string }

export function normalizeSkillDocumentText(raw: string): NormalizedSkillUpload {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Skill document is empty." }
  }

  let parsed: ReturnType<typeof parseSkillDocument>
  try {
    parsed = parseSkillDocument(trimmed)
  } catch {
    return { ok: false, error: "Could not parse skill document." }
  }

  const slug = parsed.name.trim()
  if (!isValidSkillSlug(slug)) {
    return {
      ok: false,
      error:
        'Invalid skill name in frontmatter. Use a lowercase slug matching `name`, e.g. `my-toolkit` (agentskills.io format).',
    }
  }

  const description = parsed.description.trim()
  if (!description) {
    return { ok: false, error: "Description in YAML frontmatter is required." }
  }

  if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer.`,
    }
  }

  const body = parsed.body.trim()
  if (!body) {
    return { ok: false, error: "Skill instructions body cannot be empty." }
  }

  if (body.length > MAX_SKILL_BODY_CHARS) {
    return {
      ok: false,
      error: `Instructions must be ${MAX_SKILL_BODY_CHARS} characters or fewer.`,
    }
  }

  const skillDocument = buildSkillDocument(slug, description, body)
  if (skillDocument.length > MAX_SKILL_BODY_CHARS + 2048) {
    return { ok: false, error: "Skill document is too large." }
  }

  return { ok: true, skillDocument, slug, description, body }
}
