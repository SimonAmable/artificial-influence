import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAIGatewayProvider, hasAIGatewayCredentials, AI_GATEWAY_CONFIG_ERROR } from "@/lib/ai/gateway"
import { generateObject } from "ai"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { url, assetType, fileName } = body

    if (!url || !assetType) {
      return NextResponse.json({ error: "URL and assetType are required" }, { status: 400 })
    }

    // Include a reasonable size limit checking
    try {
      const headResponse = await fetch(url, { method: "HEAD" })
      if (headResponse.ok) {
        const contentLength = headResponse.headers.get("content-length")
        if (contentLength) {
          const sizeInBytes = parseInt(contentLength, 10)
          const maxSize = 10 * 1024 * 1024 // 10MB
          if (sizeInBytes > maxSize) {
            return NextResponse.json(
              { error: "Asset is too large for AI autofill (max 10MB)" },
              { status: 413 }
            )
          }
        }
      }
    } catch (e) {
      // Ignored: continue if HEAD request fails
      console.warn("[assets-autofill] Failed to check file size:", e)
    }

    const gateway = createAIGatewayProvider()
    const model = gateway("google/gemini-2.5-flash")

    const { object } = await generateObject({
      model,
      schema: z.object({
        title: z.string().describe("A concise, user-facing title for this asset. Max 5 words."),
        category: z.enum([
          "character",
          "scene",
          "texture",
          "thumbnails",
          "motion",
          "audio",
          "shorts",
          "product"
        ]).describe("The best matching category for this asset."),
        tags: z.array(z.string()).describe("Up to 5 relevant tags describing the asset."),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this ${assetType} and suggest a title, a category, and tags. Keep it simple and informative for a user.`
            },
            ...(fileName ? [{ type: "text", text: `The file is named: "${fileName}"` } as const] : []),
            ...(assetType === "image" ? [{ type: "image", image: new URL(url) } as const] : [])
          ]
        }
      ]
    })

    return NextResponse.json({ result: object })
  } catch (error) {
    console.error("[assets-autofill] Exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
