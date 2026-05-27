import { TemplatesGallery } from "@/components/templates/templates-gallery"
import { createClient } from "@/lib/supabase/server"
import { listTemplatesForGallery } from "@/lib/templates/database-server"

export const metadata = {
  title: "Templates",
  description: "AI-powered content creation templates",
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const templates = await listTemplatesForGallery(user?.id ?? null)

  return (
    <main className="min-h-screen bg-background">
      <TemplatesGallery templates={templates} currentUserId={user?.id ?? null} />
    </main>
  )
}
