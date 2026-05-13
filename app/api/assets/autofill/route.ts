import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAIGatewayProvider, hasAIGatewayCredentials, AI_GATEWAY_CONFIG_ERROR } from "@/lib/ai/gateway"
import { generateObject } from "ai"
import { z } from "zod"
import { ASSET_CATEGORIES, getDefaultCategoryByType } from "@/lib/assets/library"
import type { AssetCategory, AssetType } from "@/lib/assets/types"

function inferMediaType(assetType: AssetType, url: string): string {
  const lower = url.split("?")[0]?.toLowerCase() ?? ""
  if (assetType === "image") {
    if (lower.endsWith(".png")) return "image/png"
    if (lower.endsWith(".webp")) return "image/webp"
    if (lower.endsWith(".gif")) return "image/gif"
    return "image/jpeg"
  }
  if (assetType === "video") {
    if (lower.endsWith(".webm")) return "video/webm"
    if (lower.endsWith(".mov")) return "video/quicktime"
    return "video/mp4"
  }
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  return "audio/mpeg"
}

function narrativeGuidance(category: AssetCategory, assetType: AssetType): string {
  const motion =
    category === "motion"
      ? "This asset is categorized as MOTION: write a detailed description of movement over time—tempo, choreography, body mechanics, gestures, transitions, camera motion, framing changes, energy, and notable beats. If the media is short, infer likely intent."
      : ""
  const character =
    category === "character"
      ? "This asset is categorized as CHARACTER: write a generalized character brief—silhouette, apparent age range, skin tone, hair, build, wardrobe palette, accessories, personality vibe. Do not over-specify unique facial micro-features; the user may attach separate face references."
      : ""
  const scene =
    category === "scene"
      ? "This asset is categorized as SCENE: describe environment, spatial layout, depth, time of day, lighting direction and quality, color palette, materials, and mood."
      : ""
  const element =
    category === "element"
      ? "This asset is categorized as ELEMENT: explain what the asset is (prop, product, texture, sound bed, VO style, etc.) and concrete ways an agent should reuse it."
      : ""

  const modality =
    assetType === "audio"
      ? "Listen to the audio and describe timbre, pacing, language if speech, music genre if music, and production feel."
      : assetType === "video"
        ? "Use the video (visuals and motion; note audio if present)."
        : "Use the image pixels."

  return [motion, character, scene, element, modality].filter(Boolean).join("\n\n")
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const assetType = body.assetType as AssetType
    const fileName = typeof body.fileName === "string" ? body.fileName : ""
    const categoryCandidate = body.category as AssetCategory | undefined

    const category: AssetCategory =
      categoryCandidate && ASSET_CATEGORIES.includes(categoryCandidate)
        ? categoryCandidate
        : getDefaultCategoryByType(assetType)

    if (!url || !assetType) {
      return NextResponse.json({ error: "URL and assetType are required" }, { status: 400 })
    }
    if (!["image", "video", "audio"].includes(assetType)) {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 })
    }

    try {
      const headResponse = await fetch(url, { method: "HEAD" })
      if (headResponse.ok) {
        const contentLength = headResponse.headers.get("content-length")
        if (contentLength) {
          const sizeInBytes = parseInt(contentLength, 10)
          const maxSize = 10 * 1024 * 1024
          if (sizeInBytes > maxSize) {
            return NextResponse.json(
              { error: "Asset is too large for AI autofill (max 10MB)" },
              { status: 413 },
            )
          }
        }
      }
    } catch (e) {
      console.warn("[assets-autofill] Failed to check file size:", e)
    }

    const gateway = createAIGatewayProvider()
    const model = gateway("google/gemini-2.5-flash")

    const mediaType = inferMediaType(assetType, url)
    const mediaParts =
      assetType === "image"
        ? ([{ type: "image", image: new URL(url) } as const] as const)
        : ([
            {
              type: "file",
              data: new URL(url),
              mediaType,
              filename: fileName || undefined,
            } as const,
          ] as const)

    const { object } = await generateObject({
      model,
      schema: z.object({
        title: z.string().describe("A concise, user-facing title for this asset. Max 5 words."),
        category: z
          .enum(["character", "scene", "motion", "element"])
          .describe("The best matching category for this asset."),
        tags: z.array(z.string()).describe("Up to 5 relevant tags describing the asset."),
        description: z
          .string()
          .max(8000)
          .describe(
            "Long-form agent context: dense prose the creative agent can rely on when this asset is attached or searched. Not a short social caption.",
          ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Analyze this ${assetType} for a creator asset library.`,
                `The user selected library category "${category}". Follow the guidance below when writing the "description" field.`,
                narrativeGuidance(category, assetType),
                `Also propose title, category (you may revise if clearly wrong), tags, and the description.`,
                `Keep title and tags user-friendly; make "description" detailed and technical enough for an AI video/image agent.`,
              ].join("\n\n"),
            },
            ...(fileName ? [{ type: "text", text: `Original file name: "${fileName}"` } as const] : []),
            ...mediaParts,
          ],
        },
      ],
    })

    return NextResponse.json({ result: object })
  } catch (error) {
    console.error("[assets-autofill] Exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
