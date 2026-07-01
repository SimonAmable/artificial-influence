import { ExplorePage } from "@/components/explore/explore-page"
import { listSavedExamplesForGallery } from "@/lib/examples/database-server"
import { createClient } from "@/lib/supabase/server"
import { listTemplatesForGallery } from "@/lib/templates/database-server"

export const metadata = {
  title: "Explore",
  description: "Explore reusable image and video templates and examples.",
}

export default async function ExploreRoute() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [templates, examples] = await Promise.all([
    listTemplatesForGallery(user?.id ?? null, "photo"),
    listSavedExamplesForGallery(user?.id ?? null, "image"),
  ])

  return (
    <main className="min-h-screen bg-background">
      <ExplorePage initialTemplates={templates} initialExamples={examples} />
    </main>
  )
}
