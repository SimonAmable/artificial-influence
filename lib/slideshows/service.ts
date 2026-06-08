import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listSlideshowCollections } from "@/lib/slideshow/database-server"
import {
  createSlideshowProject,
  createSlideshowTemplate,
  getSlideshowTemplate,
} from "@/lib/slideshows/database-server"
import {
  instantiateBlueprint,
  planSlideshowTemplate,
  resolveBlueprintContent,
} from "@/lib/slideshows/planner"
import { resolveSlideshowProject } from "@/lib/slideshows/resolver"
import type { SlideshowAspectRatio } from "@/lib/slideshows/types"

export async function createAndResolveSlideshow(
  supabase: SupabaseClient,
  userId: string,
  input: {
    brief: string
    templateId?: string
    aspectRatio: SlideshowAspectRatio
    brandKitId?: string | null
    slideCount?: number
  },
) {
  let template = input.templateId
    ? await getSlideshowTemplate(supabase, userId, input.templateId)
    : null

  if (!template) {
    const collections = await listSlideshowCollections(supabase, userId)
    const plan = await planSlideshowTemplate({
      brief: input.brief,
      aspectRatio: input.aspectRatio,
      slideCount: input.slideCount,
      collections,
    })
    template = await createSlideshowTemplate(supabase, userId, {
      name: plan.templateName,
      description: plan.templateDescription,
      aspectRatio: input.aspectRatio,
      blueprint: plan.blueprint,
      origin: "generated",
    })
  }

  const resolvedBlueprint = await resolveBlueprintContent({
    brief: input.brief,
    blueprint: template.blueprint,
  })
  const project = await createSlideshowProject(supabase, userId, {
    template,
    brief: input.brief,
    brandKitId: input.brandKitId,
    slides: instantiateBlueprint(resolvedBlueprint),
  })
  return resolveSlideshowProject(supabase, userId, project.id)
}
