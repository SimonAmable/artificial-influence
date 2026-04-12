import type { SupabaseClient } from "@supabase/supabase-js"

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

/** When multiple rows share a slug (private + public), prefer the current user's row. */
export async function fetchSkillRowBySlug(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<SkillRow | null> {
  const { data, error } = await supabase
    .from("skills")
    .select("slug, title, skill_document, user_id")
    .eq("slug", slug)

  if (error) {
    console.error("[skills] fetchSkillRowBySlug:", error.message)
    return null
  }

  const rows = (data ?? []) as SkillRow[]
  if (rows.length === 0) {
    return null
  }

  const sorted = sortRowsUserFirst(rows, userId)
  return sorted[0] ?? null
}
