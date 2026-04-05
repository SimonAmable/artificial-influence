import { MiniAppsShowcaseSection } from "@/components/mini-apps/mini-apps-showcase-section"
import { listPublishedMiniApps } from "@/lib/mini-apps/database-server"

export default async function AppsPage() {
  const miniApps = await listPublishedMiniApps()

  return <MiniAppsShowcaseSection miniApps={miniApps} />
}
