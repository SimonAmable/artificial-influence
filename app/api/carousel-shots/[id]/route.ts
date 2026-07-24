import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isCarouselShotsMetadata } from "@/lib/carousel-shots/types"
import { CAROUSEL_SHOTS_TOOL } from "@/lib/carousel-shots/constants"
import { runCarouselShotsGeneration } from "@/lib/server/carousel-shots-run"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: generation, error: fetchError } = await supabase
    .from("generations")
    .select("id, created_at, metadata, tool, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  if (generation.tool !== CAROUSEL_SHOTS_TOOL || !isCarouselShotsMetadata(generation.metadata)) {
    return NextResponse.json({ error: "Not a carousel shots generation" }, { status: 400 })
  }

  return NextResponse.json({
    generationId: generation.id,
    createdAt: generation.created_at,
    metadata: generation.metadata,
  })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const shots = (body as { shots?: unknown }).shots
  if (!Array.isArray(shots)) {
    return NextResponse.json({ error: "shots array is required" }, { status: 400 })
  }

  const { data: generation, error: fetchError } = await supabase
    .from("generations")
    .select("id, metadata, tool, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  if (generation.tool !== CAROUSEL_SHOTS_TOOL || !isCarouselShotsMetadata(generation.metadata)) {
    return NextResponse.json({ error: "Not a carousel shots generation" }, { status: 400 })
  }

  const nextMetadata = {
    ...generation.metadata,
    shots,
  }

  const { error: updateError } = await supabase
    .from("generations")
    .update({ metadata: nextMetadata })
    .eq("id", id)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ metadata: nextMetadata })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  if ((body as { action?: string }).action !== "regenerate") {
    return NextResponse.json({ error: 'action must be "regenerate"' }, { status: 400 })
  }

  const { data: generation, error: fetchError } = await supabase
    .from("generations")
    .select("metadata, tool, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  if (generation.tool !== CAROUSEL_SHOTS_TOOL || !isCarouselShotsMetadata(generation.metadata)) {
    return NextResponse.json({ error: "Not a carousel shots generation" }, { status: 400 })
  }

  const metadata = generation.metadata
  const referencePaths = metadata.referenceImageStoragePaths
  if (referencePaths.length === 0) {
    return NextResponse.json({ error: "Missing reference image paths" }, { status: 400 })
  }

  const referenceImageUrls = referencePaths.map((path) => {
    const { data } = supabase.storage.from("public-bucket").getPublicUrl(path)
    return data.publicUrl
  })

  try {
    const result = await runCarouselShotsGeneration({
      aspectRatio: metadata.aspectRatio,
      gridSize: metadata.gridSize,
      model: metadata.model,
      referenceImageStoragePaths: referencePaths,
      referenceImageUrls,
      supabase,
      userId: user.id,
      variationStrength: metadata.variationStrength,
    })

    return NextResponse.json({
      generationId: result.generationId,
      metadata: result.metadata,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed"
    if (error instanceof Error && error.name === "InsufficientCreditsError") {
      return NextResponse.json({ error: "Insufficient credits.", message }, { status: 402 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
