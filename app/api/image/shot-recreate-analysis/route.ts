import { generateObject } from "ai"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"
import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const shotAnalysisSchema = z.object({
  scene: z.string(),
  activity: z.string(),
  pose: z.string(),
  expression: z.string(),
  camera: z.string(),
  composition: z.string(),
  lighting: z.string(),
  aesthetic: z.string(),
  wardrobe: z.string(),
})

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
    const referenceFile = formData.get("reference")
    const referenceUrlValue = formData.get("referenceUrl")
    const referenceUrl =
      typeof referenceUrlValue === "string" ? referenceUrlValue.trim() : ""

    let imagePart:
      | { type: "image"; image: Uint8Array; mediaType: string }
      | { type: "image"; image: URL }

    if (referenceFile instanceof File) {
      if (!referenceFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "Reference must be an image" }, { status: 400 })
      }
      if (referenceFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Reference image is too large" }, { status: 413 })
      }
      imagePart = {
        type: "image",
        image: new Uint8Array(await referenceFile.arrayBuffer()),
        mediaType: referenceFile.type,
      }
    } else if (referenceUrl) {
      const safeUrl = await validateExternalReferenceUrl({
        url: referenceUrl,
        expectedKind: "image",
        maxContentLengthBytes: MAX_IMAGE_BYTES,
      })
      imagePart = { type: "image", image: new URL(safeUrl) }
    } else {
      return NextResponse.json({ error: "Reference shot is required" }, { status: 400 })
    }

    const gateway = createAIGatewayProvider()
    const { object } = await generateObject({
      model: gateway("google/gemini-3.1-flash-lite"),
      schema: shotAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this image as a reusable social-media shot recipe. Describe the scene, activity, exact pose and hand placement, expression, camera and lens feel, composition and framing, lighting, aesthetic, and wardrobe. " +
                "Do not describe or identify the person's facial identity, ethnicity, or unique biometric features. Be concrete and concise so an image model can recreate the shot with a different supplied character.",
            },
            imagePart,
          ],
        },
      ],
    })

    return NextResponse.json({ shotRecipe: object })
  } catch (error) {
    console.error("[shot-recreate-analysis] Failed:", error)
    return NextResponse.json(
      { error: "Could not analyze this shot. Please try again." },
      { status: 500 },
    )
  }
}
