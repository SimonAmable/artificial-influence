import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  applyTermsVersionCookieToResponse,
  getCurrentTermsClientPayload,
  getCurrentTermsDocument,
  getTermsAcceptanceStatus,
  TERMS_VERSION_COOKIE,
} from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentTerms = getCurrentTermsDocument()
    const cookieStore = await cookies()
    const cookieVersion = cookieStore.get(TERMS_VERSION_COOKIE)?.value

    if (cookieVersion === currentTerms.version) {
      return NextResponse.json({
        needsAcceptance: false,
        reason: null,
        acceptedAt: null,
        acceptedVersion: cookieVersion,
        currentTerms: getCurrentTermsClientPayload(),
      })
    }

    const status = await getTermsAcceptanceStatus(supabase, user.id)
    const response = NextResponse.json(status)

    if (!status.needsAcceptance) {
      applyTermsVersionCookieToResponse(response, currentTerms.version)
    }

    return response
  } catch (error) {
    console.error("[legal] acceptance-status", error)
    return NextResponse.json({ error: "Failed to load terms status." }, { status: 500 })
  }
}
