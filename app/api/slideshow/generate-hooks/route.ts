import { NextResponse } from "next/server"
import { z } from "zod"
import { hasAIGatewayCredentials, AI_GATEWAY_CONFIG_ERROR } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { generateSlideshowHooks } from "@/lib/slideshow/ai"
import { loadOwnedSlideshowBrandKit, loadOwnedSlideshowSocialConnection } from "@/lib/slideshow/context-server"
import { getSlideshowProjectById, updateSlideshowProject } from "@/lib/slideshow/database-server"

const requestSchema = z.object({
  projectId: z.string().uuid(),
  socialConnectionId: z.string().uuid(),
  brandKitId: z.string().uuid(),
})

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const project = await getSlideshowProjectById(supabase, user.id, parsed.data.projectId)
    if (!project) {
      return NextResponse.json({ error: "Slideshow project not found." }, { status: 404 })
    }

    const connection = await loadOwnedSlideshowSocialConnection(supabase, user.id, parsed.data.socialConnectionId)
    const brandKit = await loadOwnedSlideshowBrandKit(supabase, user.id, parsed.data.brandKitId)
    const hookOptions = await generateSlideshowHooks({ connection, brandKit })

    const updatedProject = await updateSlideshowProject(supabase, user.id, project.id, {
      socialConnectionId: connection.id,
      brandKitId: brandKit.id,
      hookOptions,
      selectedHook: null,
      slides: [],
      status: "hooks_generated",
    })

    return NextResponse.json({ hookOptions, project: updatedProject })
  } catch (error) {
    console.error("[slideshow/generate-hooks] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate slideshow hooks." },
      { status: 500 },
    )
  }
}
