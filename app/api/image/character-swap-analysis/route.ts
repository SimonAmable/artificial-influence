import { generateObject } from "ai"
import { NextRequest, NextResponse } from "next/server"

import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import {
  CHARACTER_SWAP_ANALYSIS_INSTRUCTIONS,
  CHARACTER_SWAP_ANALYSIS_MODEL,
  characterSwapVisionHintsSchema,
} from "@/lib/image/studio-tools/character-swap-analysis"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"
import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type ImagePart =
  | { type: "image"; image: Uint8Array; mediaType: string }
  | { type: "image"; image: URL }

async function resolveImagePart(
  file: FormDataEntryValue | null,
  urlValue: FormDataEntryValue | null,
  label: string,
): Promise<ImagePart> {
  if (file instanceof File) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${label} must be an image`)
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${label} image is too large`)
    }
    return {
      type: "image",
      image: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
    }
  }

  const url = typeof urlValue === "string" ? urlValue.trim() : ""
  if (url) {
    const safeUrl = await validateExternalReferenceUrl({
      url,
      expectedKind: "image",
      maxContentLengthBytes: MAX_IMAGE_BYTES,
    })
    return { type: "image", image: new URL(safeUrl) }
  }

  throw new Error(`${label} image is required`)
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const characterPart = await resolveImagePart(
      formData.get("character"),
      formData.get("characterUrl"),
      "Character reference",
    )
    const scenePart = await resolveImagePart(
      formData.get("scene"),
      formData.get("sceneUrl"),
      "Scene reference",
    )

    const gateway = createAIGatewayProvider()
    const { object } = await generateObject({
      model: gateway(CHARACTER_SWAP_ANALYSIS_MODEL),
      schema: characterSwapVisionHintsSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CHARACTER_SWAP_ANALYSIS_INSTRUCTIONS },
            { type: "text", text: "Image 1 — reference character:" },
            characterPart,
            { type: "text", text: "Image 2 — reference scene and pose:" },
            scenePart,
          ],
        },
      ],
    })

    return NextResponse.json({ hints: object })
  } catch (error) {
    console.error("[character-swap-analysis] Failed:", error)
    const message =
      error instanceof Error ? error.message : "Could not analyze character swap references"
    const status =
      message.includes("too large") ? 413 : message.includes("required") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
