import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import { retryViralCloneItem } from "@/lib/viral-cloner/retry"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300

type RouteContext = {
  params: Promise<{ jobId: string; itemIndex: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to retry." }, { status: 401 })
    }

    const { jobId, itemIndex: itemIndexRaw } = await context.params
    const itemIndex = Number.parseInt(itemIndexRaw, 10)
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return NextResponse.json({ error: "Invalid item index." }, { status: 400 })
    }

    waitUntil(
      retryViralCloneItem({
        userId: user.id,
        jobId,
        itemIndex,
      }),
    )

    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}