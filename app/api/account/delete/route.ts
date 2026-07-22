import { NextRequest, NextResponse } from "next/server"

import { deleteAllUserData } from "@/lib/account/delete-user-data"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const confirmationEmail =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as { confirmationEmail?: unknown }).confirmationEmail === "string"
        ? (body as { confirmationEmail: string }).confirmationEmail.trim()
        : ""

    const accountEmail = (user.email ?? "").trim().toLowerCase()
    if (!accountEmail) {
      return NextResponse.json({ error: "Account email is missing." }, { status: 400 })
    }

    if (confirmationEmail.toLowerCase() !== accountEmail) {
      return NextResponse.json(
        { error: "Confirmation email does not match your account email." },
        { status: 400 }
      )
    }

    await deleteAllUserData(user.id)
    await supabase.auth.signOut()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[account/delete]", error)
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 })
  }
}
