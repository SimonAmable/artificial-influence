import { NextResponse } from "next/server"

import { getOwnedImportManifest } from "@/lib/social-imports/service"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to view imports." }, { status: 401 })
    }

    const { id } = await context.params
    const { manifest, row } = await getOwnedImportManifest({
      supabase,
      userId: user.id,
      importId: id,
    })

    return NextResponse.json({
      id,
      status: row.status,
      manifest,
      expiresAt: row.expires_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import not found."
    return NextResponse.json({ error: message }, { status: 404 })
  }
}