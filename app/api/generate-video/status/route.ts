import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function inferVideoMimeType(storagePath: string) {
  const lower = storagePath.toLowerCase()
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mov")) return "video/quicktime"
  return "video/mp4"
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const predictionId = request.nextUrl.searchParams.get("predictionId")
    if (!predictionId) {
      return NextResponse.json({ error: "predictionId is required" }, { status: 400 })
    }

    const { data: generation, error } = await supabase
      .from("generations")
      .select("id, status, supabase_storage_path, error_message")
      .eq("replicate_prediction_id", predictionId)
      .eq("user_id", user.id)
      .eq("type", "video")
      .maybeSingle()

    if (error) {
      console.error("[generate-video/status]", error)
      return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
    }

    if (!generation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (generation.status === "pending") {
      return NextResponse.json({
        status: "pending",
        generationId: generation.id,
      })
    }

    if (generation.status === "failed") {
      return NextResponse.json({
        status: "failed",
        generationId: generation.id,
        error: generation.error_message || "Generation failed",
      })
    }

    if (generation.status === "completed" && generation.supabase_storage_path) {
      const { data: urlData } = supabase.storage
        .from("public-bucket")
        .getPublicUrl(generation.supabase_storage_path)

      return NextResponse.json({
        status: "completed",
        generationId: generation.id,
        video: {
          url: urlData.publicUrl,
          mimeType: inferVideoMimeType(generation.supabase_storage_path),
        },
      })
    }

    return NextResponse.json({
      status: generation.status,
      generationId: generation.id,
    })
  } catch (error) {
    console.error("[generate-video/status]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
