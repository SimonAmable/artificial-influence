import { NextResponse } from "next/server"

import { quoteViralCloneSelection } from "@/lib/viral-cloner/pricing"
import { createViralInspectImport } from "@/lib/social-imports/service"
import { createClient } from "@/lib/supabase/server"

type InspectBody = {
  sourceUrl?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to inspect social posts." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as InspectBody
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : ""
    if (!sourceUrl) {
      return NextResponse.json({ error: "Paste a post URL." }, { status: 400 })
    }

    const { importId, manifest } = await createViralInspectImport({
      supabase,
      userId: user.id,
      sourceUrl,
    })

    const quotePreview = quoteViralCloneSelection({
      items: manifest.media.map((item) => ({
        index: item.index,
        kind: item.kind,
        durationSeconds: item.durationSeconds,
      })),
      selectedIndexes: manifest.media.map((item) => item.index),
      trims: {},
      includeImportFee: true,
    })

    return NextResponse.json({
      importId,
      source: {
        platform: manifest.platform,
        canonicalUrl: manifest.canonicalUrl,
        title: manifest.sourceTitle,
      },
      media: manifest.media,
      quotePreview,
      expiresAt: manifest.expiresAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}