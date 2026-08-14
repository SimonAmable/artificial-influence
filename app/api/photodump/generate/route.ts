import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { authContextFailureResponse } from "@/lib/server/require-active-user"
import {
  isPhotodumpAspectRatio,
  isPhotodumpModelId,
  isPhotodumpShotCount,
  PHOTODUMP_CUSTOM_PRESET_ID,
  PHOTODUMP_MAX_AESTHETIC_REFS,
  PHOTODUMP_MAX_NOTE_LENGTH,
} from "@/lib/photodump/constants"
import { getPhotodumpPackById } from "@/lib/photodump/packs"
import { runPhotodumpGeneration } from "@/lib/server/photodump-run"
import { isContentModerationMessage } from "@/lib/generate-image-client"

export const maxDuration = 300

const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024

async function uploadReferenceImage(
  supabase: Awaited<ReturnType<typeof getAuthenticatedRequestContext>>["supabase"],
  userId: string,
  file: File,
  folder: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  const fileExtension = file.name.split(".").pop() || "png"
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const storagePath = `${userId}/${folder}/${timestamp}-${randomStr}.${fileExtension}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
  return { storagePath, publicUrl: urlData.publicUrl }
}

function parseNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, PHOTODUMP_MAX_NOTE_LENGTH)
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
    const presetIdRaw = formData.get("presetId")
    const aspectRatioRaw = formData.get("aspectRatio")
    const shotCountRaw = Number(formData.get("shotCount"))
    const modelRaw = formData.get("model")
    const note = parseNote(formData.get("note"))

    if (!(referenceImage instanceof File) || referenceImage.size === 0) {
      return NextResponse.json({ error: "referenceImage is required" }, { status: 400 })
    }

    if (typeof presetIdRaw !== "string" || !presetIdRaw.trim()) {
      return NextResponse.json({ error: "presetId is required" }, { status: 400 })
    }

    const pack = getPhotodumpPackById(presetIdRaw.trim())
    if (!pack) {
      return NextResponse.json({ error: "Unknown preset" }, { status: 400 })
    }

    if (typeof aspectRatioRaw !== "string" || !isPhotodumpAspectRatio(aspectRatioRaw)) {
      return NextResponse.json({ error: "aspectRatio must be 9:16, 4:5, or 1:1" }, { status: 400 })
    }

    if (!isPhotodumpShotCount(shotCountRaw)) {
      return NextResponse.json({ error: "shotCount must be 6, 9, 12, or 15" }, { status: 400 })
    }

    if (typeof modelRaw !== "string" || !isPhotodumpModelId(modelRaw)) {
      return NextResponse.json({ error: "Unsupported model for photodump" }, { status: 400 })
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

    const aestheticFiles = formData
      .getAll("aestheticReferences")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    const isCustom = pack.id === PHOTODUMP_CUSTOM_PRESET_ID
    if (isCustom && aestheticFiles.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one aesthetic reference for a custom preset" },
        { status: 400 },
      )
    }

    if (aestheticFiles.length > PHOTODUMP_MAX_AESTHETIC_REFS) {
      return NextResponse.json(
        { error: `At most ${PHOTODUMP_MAX_AESTHETIC_REFS} aesthetic references allowed` },
        { status: 400 },
      )
    }

    for (const file of aestheticFiles) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Aesthetic references must be images" }, { status: 400 })
      }
      if (file.size > MAX_REFERENCE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "An aesthetic reference is too large. Maximum size is 10MB." },
          { status: 400 },
        )
      }
    }

    const subjectUpload = await uploadReferenceImage(
      supabase,
      user.id,
      referenceImage,
      "reference-images",
    )

    const aestheticReferenceStoragePaths: string[] = []
    const aestheticReferenceImageUrls: string[] = []

    for (const file of aestheticFiles) {
      const uploaded = await uploadReferenceImage(
        supabase,
        user.id,
        file,
        "photodump-aesthetic-refs",
      )
      aestheticReferenceStoragePaths.push(uploaded.storagePath)
      aestheticReferenceImageUrls.push(uploaded.publicUrl)
    }

    const result = await runPhotodumpGeneration({
      aspectRatio: aspectRatioRaw,
      aestheticReferenceImageUrls,
      aestheticReferenceStoragePaths,
      model: modelRaw,
      note,
      packId: pack.id,
      packName: pack.name,
      packStyleLine: pack.styleLine,
      referenceImageStoragePaths: [subjectUpload.storagePath],
      referenceImageUrls: [subjectUpload.publicUrl],
      shotCount: shotCountRaw,
      supabase,
      userId: user.id,
      usesAestheticReferences: isCustom && aestheticFiles.length > 0,
    })

    return NextResponse.json({
      generationId: result.generationId,
      metadata: result.metadata,
      prompt: result.prompt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photodump generation failed"

    if (error instanceof Error && error.name === "InsufficientCreditsError") {
      return NextResponse.json({ error: "Insufficient credits.", message }, { status: 402 })
    }

    if (isContentModerationMessage(message)) {
      return NextResponse.json({ error: "Content moderation", message }, { status: 400 })
    }

    console.error("[photodump/generate]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
