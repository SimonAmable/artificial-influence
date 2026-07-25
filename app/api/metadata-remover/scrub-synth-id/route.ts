import { NextRequest, NextResponse } from "next/server"

import { SYNTH_ID_SCRUB_CREDITS_COST } from "@/lib/constants/metadata-remover"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { scrubSynthIdImage } from "@/lib/server/scrub-synth-id-image"
import { createClient } from "@/lib/supabase/server"

const USER_FACING_FAILURE = "SynthID scrub failed. Please try again."

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("[metadata-remover/scrub-synth-id] REPLICATE_API_TOKEN is not set")
      return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to run a SynthID scrub." },
        { status: 401 },
      )
    }

    const hasCredits = await checkUserHasCredits(user.id, SYNTH_ID_SCRUB_CREDITS_COST, supabase)
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: "Insufficient credits.",
          message: `SynthID scrub requires ${SYNTH_ID_SCRUB_CREDITS_COST} credit.`,
        },
        { status: 402 },
      )
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Please upload an image file." },
        { status: 400 },
      )
    }

    const formData = await request.formData()
    const imageFile = formData.get("image")
    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: "Please upload an image file." },
        { status: 400 },
      )
    }

    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Please upload a supported image file." },
        { status: 400 },
      )
    }

    if (imageFile.type === "image/gif" || imageFile.type === "image/svg+xml") {
      return NextResponse.json(
        { error: "Animated and SVG images are not supported yet." },
        { status: 400 },
      )
    }

    const inputMimeType = imageFile.type.split(";")[0]?.trim() || "image/png"
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const result = await scrubSynthIdImage(buffer, inputMimeType)

    if (!result) {
      return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 })
    }

    await deductUserCredits(user.id, SYNTH_ID_SCRUB_CREDITS_COST, supabase)

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "X-Credits-Used": String(SYNTH_ID_SCRUB_CREDITS_COST),
        "X-Image-Width": String(result.width),
        "X-Image-Height": String(result.height),
      },
    })
  } catch (error) {
    console.error("[metadata-remover/scrub-synth-id] Error:", error)
    return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 })
  }
}
