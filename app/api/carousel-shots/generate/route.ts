import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { authContextFailureResponse } from "@/lib/server/require-active-user"
import {
  CAROUSEL_GENERATION_MODES,
  CAROUSEL_PANEL_ASPECT_RATIOS,
  CAROUSEL_VARIATION_STRENGTHS,
  isCarouselHdShotCount,
  isCarouselShotsModelId,
} from "@/lib/carousel-shots/constants"
import type {
  CarouselGenerationMode,
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"
import { runCarouselShotsGeneration } from "@/lib/server/carousel-shots-run"
import { isContentModerationMessage } from "@/lib/generate-image-client"

const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_CUSTOM_VARIATION_LENGTH = 500
const MAX_PER_SHOT_VARIATIONS = 12

function parseGridSize(value: FormDataEntryValue | null): CarouselGridSize | null {
  const parsed = Number(value)
  if (parsed === 4 || parsed === 9) return parsed
  return null
}

function parseShotCount(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value)
  if (!isCarouselHdShotCount(parsed)) return null
  return parsed
}

function parseGenerationMode(value: FormDataEntryValue | null): CarouselGenerationMode | null {
  if (typeof value !== "string") return null
  return CAROUSEL_GENERATION_MODES.includes(value as CarouselGenerationMode)
    ? (value as CarouselGenerationMode)
    : null
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

function parseCustomVariation(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_CUSTOM_VARIATION_LENGTH)
}

function parsePerShotVariations(value: FormDataEntryValue | null): string[] | null {
  if (typeof value !== "string" || !value.trim()) return null

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return null

    const variations = parsed
      .slice(0, MAX_PER_SHOT_VARIATIONS)
      .map((entry) => (typeof entry === "string" ? entry.trim().slice(0, MAX_CUSTOM_VARIATION_LENGTH) : ""))

    return variations.some((entry) => entry.length > 0) ? variations : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedRequestContext(request, [
      "generations:write",
    ])

    if (authError || !user) {
      return authContextFailureResponse(authError)
    }

    const formData = await request.formData()
    const referenceImage = formData.get("referenceImage")
    const generationMode = parseGenerationMode(formData.get("generationMode")) ?? "fast"
    const gridSize = parseGridSize(formData.get("gridSize"))
    const shotCountRaw = parseShotCount(formData.get("shotCount"))
    const aspectRatio = parseAspectRatio(formData.get("aspectRatio"))
    const variationStrength = parseVariationStrength(formData.get("variationStrength"))
    const customVariation = parseCustomVariation(formData.get("customVariation"))
    const perShotVariations = parsePerShotVariations(formData.get("perShotVariations"))
    const modelRaw = formData.get("model")

    if (!(referenceImage instanceof File) || referenceImage.size === 0) {
      return NextResponse.json({ error: "referenceImage is required" }, { status: 400 })
    }

    if (generationMode === "fast" && !gridSize) {
      return NextResponse.json({ error: "gridSize must be 4 or 9 for fast mode" }, { status: 400 })
    }

    if (generationMode === "hd" && shotCountRaw == null) {
      return NextResponse.json(
        { error: "shotCount must be between 1 and 12 for HD mode" },
        { status: 400 },
      )
    }

    if (!aspectRatio) {
      return NextResponse.json({ error: "aspectRatio must be 3:4, 4:5, or 9:16" }, { status: 400 })
    }

    if (!variationStrength) {
      return NextResponse.json(
        { error: "variationStrength must be subtle, natural, creative, or custom" },
        { status: 400 },
      )
    }

    if (variationStrength === "custom" && !customVariation && !perShotVariations) {
      return NextResponse.json(
        { error: "customVariation or perShotVariations is required for custom variation" },
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

    const shotCount = generationMode === "hd" ? shotCountRaw! : gridSize!

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
      generationMode,
      gridSize: generationMode === "fast" ? gridSize! : undefined,
      shotCount,
      model: modelRaw,
      referenceImageStoragePaths: [storagePath],
      referenceImageUrls: [referenceImageUrl],
      supabase,
      userId: user.id,
      variationStrength,
      customVariation,
      perShotVariations,
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
