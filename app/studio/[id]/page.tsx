import { Suspense } from "react"
import type { Metadata } from "next"
import { StudioBoardPage } from "@/components/studio/studio-board-page"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Studio Board",
  description: "Generate images on a project infinite canvas.",
}

export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { id } = await params
    redirect(`/login?next=/studio/${id}`)
  }

  const { id } = await params

  return (
    <Suspense fallback={null}>
      <StudioBoardPage projectId={id} />
    </Suspense>
  )
}
