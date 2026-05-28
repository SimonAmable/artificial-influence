import { NextResponse } from "next/server"
import { z } from "zod"
import { hasAIGatewayCredentials, AI_GATEWAY_CONFIG_ERROR } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { generateSlideshowSlides } from "@/lib/slideshow/ai"
import { loadOwnedSlideshowBrandKit, loadOwnedSlideshowSocialConnection } from "@/lib/slideshow/context-server"
import {
  getSlideshowProjectById,
  listSlideshowCollections,
  updateSlideshowProject,
} from "@/lib/slideshow/database-server"

const requestSchema = z.object({
  projectId: z.string().uuid(),
  selectedHook: z.string().trim().min(1).max(180),
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

    if (!project.brandKitId) {
      return NextResponse.json({ error: "Select a brand before generating slides." }, { status: 400 })
    }

    const connection = await loadOwnedSlideshowSocialConnection(supabase, user.id, project.socialConnectionId)
    const brandKit = await loadOwnedSlideshowBrandKit(supabase, user.id, project.brandKitId)
    const collections = await listSlideshowCollections(supabase, user.id)
    const slides = await generateSlideshowSlides({
      projectId: project.id,
      hook: parsed.data.selectedHook,
      connection,
      brandKit,
      collections,
    })

    const updatedProject = await updateSlideshowProject(supabase, user.id, project.id, {
      selectedHook: parsed.data.selectedHook,
      slides,
      status: "slides_generated",
    })

    return NextResponse.json({ slides, project: updatedProject })
  } catch (error) {
    console.error("[slideshow/generate-slides] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate slideshow slides." },
      { status: 500 },
    )
  }
}
