import type { SupabaseClient } from "@supabase/supabase-js"
import { parseSkillDocument } from "@/lib/chat/skills/skill-md"

export type SkillCatalogEntry = {
  slug: string
  title: string | null
  description: string
}

type SkillRow = {
  slug: string
  title: string | null
  skill_document: string
  user_id: string
}

function sortRowsUserFirst(rows: SkillRow[], userId: string) {
  return [...rows].sort((a, b) => {
    const aOwn = a.user_id === userId ? 1 : 0
    const bOwn = b.user_id === userId ? 1 : 0
    return bOwn - aOwn
  })
}

function dedupeBySlug(rows: SkillRow[], userId: string) {
  const sorted = sortRowsUserFirst(rows, userId)
  const seen = new Set<string>()
  const out: SkillRow[] = []
  for (const row of sorted) {
    if (seen.has(row.slug)) {
      continue
    }
    seen.add(row.slug)
    out.push(row)
  }
  return out
}

export async function loadSkillsCatalog(
  supabase: SupabaseClient,
  userId: string,
): Promise<SkillCatalogEntry[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("slug, title, skill_document, user_id")
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[skills] loadSkillsCatalog:", error.message)
    return []
  }

  const rows = (data ?? []) as SkillRow[]
  const uniqueRows = dedupeBySlug(rows, userId)

  const entries: SkillCatalogEntry[] = []
  for (const row of uniqueRows) {
    try {
      const parsed = parseSkillDocument(row.skill_document)
      const description =
        parsed.description.trim() ||
        "(Skill has no description in frontmatter; still call activateSkill to read instructions.)"
      entries.push({
        slug: row.slug,
        title: row.title,
        description,
      })
    } catch {
      entries.push({
        slug: row.slug,
        title: row.title,
        description: "(Could not parse skill document.)",
      })
    }
  }

  return entries
}

export function buildSkillsCatalogAppendix(entries: SkillCatalogEntry[]) {
  if (entries.length === 0) {
    return ""
  }

  const lines = entries.map((entry) => {
    const label = entry.title ? `${entry.title} (\`${entry.slug}\`)` : `\`${entry.slug}\``
    return `- ${label}: ${entry.description}`
  })

  return `

## Agent Skills (tier 1 — catalog only)

You have specialized **Agent Skills** (portable instruction packs). Each entry below is only a summary. When the user's task matches a skill's description, call **activateSkill** with that skill's \`slug\` **before** improvising from general knowledge, so you load the full instructions for that turn.

Available skills:
${lines.join("\n")}

Do not paste full skill bodies from memory — use **activateSkill** to load the canonical instructions. To create or overwrite a skill, use **saveSkill** (stores valid SKILL.md with frontmatter \`name\` matching \`slug\`).
`.trimEnd()
}
