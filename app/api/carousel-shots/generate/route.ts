import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import {
  CAROUSEL_PANEL_ASPECT_RATIOS,
  CAROUSEL_VARIATION_STRENGTHS,
  isCarouselShotsModelId,
} from "@/lib/carousel-shots/constants"
import type {
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"
import { runCarouselShotsGeneration } from "@/lib/server/carousel-shots-run"
import { isContentModerationMessage } from "@/lib/generate-image-client"

const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024

function parseGridSize(value: FormDataEntryValue | null): CarouselGridSize | null {
  const parsed = Number(value)
  if (parsed === 4 || parsed === 9) return parsed
  return null
}

function parseAspectRatio(value: FormDataEntryValue | null): CarouselPanelAspectRatio | null {
  if (typeof value !== "string") return null
  return CAROUSEL_PANEL_ASPECT_RATIOS.includes(value as CarouselPanelAspectRatio)
    ? (value as CarouselPanelAspectRatio)
    : null
}

function parseVariationStrength(
  value: FormDataEntryValue | null,
): CarouselVariationStrength | null {
  if (typeof value !== "string") return null
  return CAROUSEL_VARIATION_STRENGTHS.includes(value as CarouselVariationStrength)
    ? (value as CarouselVariationStrength)
    : null
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedRequestContext(request, [
      "generations:write",
    ])

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const formData = await request.formData()
    const referenceImage = formData.get("referenceImage")
    const gridSize = parseGridSize(formData.get("gridSize"))
    const aspectRatio = parseAspectRatio(formData.get("aspectRatio"))
    const variationStrength = parseVariationStrength(formData.get("variationStrength"))
    const modelRaw = formData.get("model")

    if (!(referenceImage instanceof File) || referenceImage.size === 0) {
      return NextResponse.json({ error: "referenceImage is required" }, { status: 400 })
    }

    if (!gridSize) {
      return NextResponse.json({ error: "gridSize must be 4 or 9" }, { status: 400 })
    }

    if (!aspectRatio) {
      return NextResponse.json({ error: "aspectRatio must be 3:4, 4:5, or 9:16" }, { status: 400 })
    }

    if (!variationStrength) {
      return NextResponse.json(
        { error: "variationStrength must be subtle, natural, or creative" },
        { status: 400 },
      )
    }

    if (typeof modelRaw !== "string" || !isCarouselShotsModelId(modelRaw)) {
      return NextResponse.json({ error: "Unsupported model for carousel shots" }, { status: 400 })
    }

    if (!referenceImage.type.startsWith("image/")) {
      return NextResponse.json({ error: "Reference image must be a valid image file" }, { status: 400 })
    }

    if (referenceImage.size > MAX_REFERENCE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Reference image is too large. Maximum size is 10MB." },
        { status: 400 },
      )
    }

    const fileExtension = referenceImage.name.split(".").pop() || "png"
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).slice(2, 10)
    const storagePath = `${user.id}/reference-images/${timestamp}-${randomStr}.${fileExtension}`
    const arrayBuffer = await referenceImage.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("public-bucket")
      .upload(storagePath, buffer, {
        contentType: referenceImage.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload reference image", message: uploadError.message },
        { status: 500 },
      )
    }

    const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
    const referenceImageUrl = urlData.publicUrl

    const result = await runCarouselShotsGeneration({
      aspectRatio,
      gridSize,
      model: modelRaw,
      referenceImageStoragePaths: [storagePath],
      referenceImageUrls: [referenceImageUrl],
      supabase,
      userId: user.id,
      variationStrength,
    })

    return NextResponse.json({
      generationId: result.generationId,
      metadata: result.metadata,
      prompt: result.prompt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Carousel shots generation failed"

    if (error instanceof Error && error.name === "InsufficientCreditsError") {
      return NextResponse.json({ error: "Insufficient credits.", message }, { status: 402 })
    }

    if (isContentModerationMessage(message)) {
      return NextResponse.json({ error: "Content moderation", message }, { status: 400 })
    }

    console.error("[carousel-shots/generate]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
