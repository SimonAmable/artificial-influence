import { NextResponse } from "next/server"

import { getTermsAcceptanceStatus } from "@/lib/legal/terms-acceptance"
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

    const status = await getTermsAcceptanceStatus(supabase, user.id)
    return NextResponse.json(status)
  } catch (error) {
    console.error("[legal] acceptance-status", error)
    return NextResponse.json({ error: "Failed to load terms status." }, { status: 500 })
  }
}
