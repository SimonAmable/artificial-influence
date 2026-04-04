import { NextRequest, NextResponse } from "next/server"
import { getPublishedMiniAppBySlug } from "@/lib/mini-apps/database-server"

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params
    const miniApp = await getPublishedMiniAppBySlug(slug)

    if (!miniApp) {
      return NextResponse.json({ error: "Mini app not found" }, { status: 404 })
    }

    return NextResponse.json(miniApp)
  } catch (error) {
    console.error("Error fetching mini app by slug:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch mini app" },
      { status: 500 }
    )
  }
}
