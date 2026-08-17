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

    const predictionId = request.nextUrl.searchParams.get("predictionId")?.trim() || null
    const generationId = request.nextUrl.searchParams.get("generationId")?.trim() || null
    if (!predictionId && !generationId) {
      return NextResponse.json({ error: "predictionId or generationId is required" }, { status: 400 })
    }

    const statusColumns = "id, status, supabase_storage_path, error_message"
    let generation: {
      id: string
      status: string | null
      supabase_storage_path: string | null
      error_message: string | null
    } | null = null
    let error: { message?: string } | null = null

    if (generationId) {
      const byId = await supabase
        .from("generations")
        .select(statusColumns)
        .eq("id", generationId)
        .eq("user_id", user.id)
        .eq("type", "video")
        .maybeSingle()
      error = byId.error
      generation = byId.data
    } else if (predictionId) {
      const byReplicate = await supabase
        .from("generations")
        .select(statusColumns)
        .eq("replicate_prediction_id", predictionId)
        .eq("user_id", user.id)
        .eq("type", "video")
        .maybeSingle()
      error = byReplicate.error
      generation = byReplicate.data

      if (!error && !generation) {
        const byFal = await supabase
          .from("generations")
          .select(statusColumns)
          .eq("fal_request_id", predictionId)
          .eq("user_id", user.id)
          .eq("type", "video")
          .maybeSingle()
        error = byFal.error
        generation = byFal.data
      }
    }

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
