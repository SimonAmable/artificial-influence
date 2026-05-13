import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSkillRowBySlug } from "@/lib/chat/skills/resolve-skill-row"
import { parseSkillDocument } from "@/lib/chat/skills/skill-md"

export const MAX_PINNED_SKILLS = 3

export type PinnedSkillSummary = {
  slug: string
  title: string | null
  description: string
}

export type PinnedSkillInstructionEntry = {
  slug: string
  title: string | null
  instructions: string
}

type PinnedSkillRow = {
  skill_slug: string
}

export async function loadPinnedSkillSlugsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_pinned_skills")
    .select("skill_slug")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[skills] loadPinnedSkillSlugsForUser:", error.message)
    return []
  }

  const rows = (data ?? []) as PinnedSkillRow[]
  const seen = new Set<string>()
  const slugs: string[] = []

  for (const row of rows) {
    if (!row.skill_slug || seen.has(row.skill_slug)) {
      continue
    }

    seen.add(row.skill_slug)
    slugs.push(row.skill_slug)
  }

  return slugs
}

export async function loadPinnedSkillSummariesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PinnedSkillSummary[]> {
  const slugs = await loadPinnedSkillSlugsForUser(supabase, userId)
  const entries: PinnedSkillSummary[] = []

  for (const slug of slugs) {
    const row = await fetchSkillRowBySlug(supabase, userId, slug)
    if (!row) {
      continue
    }

    try {
      const parsed = parseSkillDocument(row.skill_document)
      entries.push({
        slug: row.slug,
        title: row.title,
        description: parsed.description.trim() || "(Skill has no description.)",
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

export async function loadPinnedSkillInstructionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PinnedSkillInstructionEntry[]> {
  const slugs = await loadPinnedSkillSlugsForUser(supabase, userId)
  const entries: PinnedSkillInstructionEntry[] = []

  for (const slug of slugs) {
    const row = await fetchSkillRowBySlug(supabase, userId, slug)
    if (!row) {
      continue
    }

    try {
      const parsed = parseSkillDocument(row.skill_document)
      const instructions = parsed.body.trim()

      if (!instructions) {
        continue
      }

      entries.push({
        slug: row.slug,
        title: row.title,
        instructions,
      })
    } catch {
      continue
    }
  }

  return entries
}
