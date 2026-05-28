import { NextResponse } from "next/server"
import { z } from "zod"
import { createInstagramPostJob } from "@/lib/autopost/create-instagram-post-job"
import { createTikTokPostJob } from "@/lib/autopost/create-tiktok-post-job"
import { createClient } from "@/lib/supabase/server"
import { loadOwnedSlideshowSocialConnection } from "@/lib/slideshow/context-server"
import {
  getSlideshowProjectById,
  updateSlideshowProject,
} from "@/lib/slideshow/database-server"

const requestSchema = z.object({
  renderedSlideUrls: z.array(z.string().url()).min(1).max(10),
})

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
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

    const project = await getSlideshowProjectById(supabase, user.id, id)
    if (!project) {
      return NextResponse.json({ error: "Slideshow project not found." }, { status: 404 })
    }

    if (project.slides.length === 0) {
      return NextResponse.json({ error: "Generate slides before creating a draft." }, { status: 400 })
    }

    if (parsed.data.renderedSlideUrls.length !== project.slides.length) {
      return NextResponse.json(
        { error: "Rendered slide count must match the slideshow project slide count." },
        { status: 400 },
      )
    }

    const socialConnection = await loadOwnedSlideshowSocialConnection(
      supabase,
      user.id,
      project.socialConnectionId,
    )

    const caption = project.selectedHook ?? ""

    if (project.provider === "instagram") {
      if (!socialConnection.instagramConnectionId) {
        return NextResponse.json(
          { error: "This Instagram connection is missing its publishable account link." },
          { status: 400 },
        )
      }

      const result = await createInstagramPostJob({
        input: {
          action: "draft",
          caption,
          instagramConnectionId: socialConnection.instagramConnectionId,
          mediaType: "carousel",
          carouselItems: parsed.data.renderedSlideUrls.map((url) => ({
            url,
            kind: "image" as const,
          })),
        },
        supabase,
        supabaseUrl,
        userId: user.id,
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: result.statusCode })
      }

      const updatedProject = await updateSlideshowProject(supabase, user.id, project.id, {
        autopostJobId: result.job.id,
        status: "draft_created",
      })

      return NextResponse.json({
        jobId: result.job.id,
        project: updatedProject,
        redirectTo: "/autopost",
      })
    }

    const result = await createTikTokPostJob({
      input: {
        action: "draft",
        tiktokConnectionId: socialConnection.id,
        mode: "upload",
        postType: "photo",
        caption,
        description: caption || undefined,
        photoItems: parsed.data.renderedSlideUrls,
        photoCoverIndex: 0,
      },
      supabase,
      supabaseUrl,
      userId: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.statusCode })
    }

    const updatedProject = await updateSlideshowProject(supabase, user.id, project.id, {
      autopostJobId: result.job.id,
      status: "draft_created",
    })

    return NextResponse.json({
      jobId: result.job.id,
      project: updatedProject,
      redirectTo: "/autopost",
    })
  } catch (error) {
    console.error("[slideshow/projects/id/finalize] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create slideshow draft." },
      { status: 500 },
    )
  }
}
