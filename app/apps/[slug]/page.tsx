import { notFound } from "next/navigation"
import { getPublishedMiniAppBySlug } from "@/lib/mini-apps/database-server"
import { MiniAppRuntime } from "@/components/mini-apps/mini-app-runtime"

interface MiniAppPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function MiniAppPage({ params }: MiniAppPageProps) {
  const resolvedParams = await params
  const miniApp = await getPublishedMiniAppBySlug(resolvedParams.slug)

  if (!miniApp) {
    notFound()
  }

  return <MiniAppRuntime miniApp={miniApp} />
}
