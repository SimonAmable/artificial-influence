import { createClient } from "@/lib/supabase/server"
import { loadSkillsCatalogForPicker } from "@/lib/chat/skills/catalog"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const skills = await loadSkillsCatalogForPicker(supabase, user.id)
  return Response.json({ skills })
}
