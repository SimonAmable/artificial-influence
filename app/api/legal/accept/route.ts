import { NextResponse } from "next/server"

import {
  applyTermsVersionCookieToResponse,
  recordCurrentTermsAcceptance,
} from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const record = await recordCurrentTermsAcceptance(supabase, user.id, "blocking_modal")
    const response = NextResponse.json({
      ok: true,
      acceptedAt: record.acceptedAt,
      currentTerms: {
        title: record.currentTerms.title,
        version: record.currentTerms.version,
        lastUpdated: record.currentTerms.lastUpdated,
      },
    })
    applyTermsVersionCookieToResponse(response, record.currentTerms.version)
    return response
  } catch (error) {
    console.error("[legal] accept", error)
    return NextResponse.json({ error: "Failed to save terms acceptance." }, { status: 500 })
  }
}
