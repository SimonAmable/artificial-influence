import { Suspense } from "react"
import type { Metadata } from "next"
import { StudioProjectsPage } from "@/components/studio/studio-projects-page"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Studio",
  description: "Project-based image generation on an infinite canvas.",
}

export default async function StudioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/studio")
  }

  return (
    <Suspense fallback={null}>
      <StudioProjectsPage />
    </Suspense>
  )
}
