import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  getSlideshowProject,
  listSlideshowProjects,
  listSlideshowTemplates,
} from "@/lib/slideshows/database-server"
import { renderSlideshowProject } from "@/lib/slideshows/renderer"
import { createAndResolveSlideshow } from "@/lib/slideshows/service"

export function createManageSlideshowsTool(input: {
  source: "chat" | "automation" | "resume"
  supabase: SupabaseClient
  userId: string
}) {
  return tool({
    description:
      "Create, inspect, or list reusable static-image slideshow projects and templates. A slideshow can mix collection images, AI-generated images, collection images edited by AI, baked-in image text, and editable overlays. In normal chat, creation stops at an editable draft. Scheduled automations render a ready slideshow draft automatically.",
    inputSchema: z.discriminatedUnion("action", [
      z.object({ action: z.literal("list_projects"), limit: z.number().int().min(1).max(20).default(8) }),
      z.object({ action: z.literal("list_templates"), limit: z.number().int().min(1).max(20).default(8) }),
      z.object({ action: z.literal("get_project"), projectId: z.string().uuid() }),
      z.object({
        action: z.literal("create"),
        brief: z.string().trim().min(4).max(8000),
        templateId: z.string().uuid().optional(),
        aspectRatio: z.enum(["9:16", "4:5", "1:1"]).default("9:16"),
        slideCount: z.number().int().min(1).max(35).optional(),
        brandKitId: z.string().uuid().nullable().optional(),
      }),
    ]),
    execute: async (request) => {
      if (request.action === "list_projects") {
        const projects = await listSlideshowProjects(input.supabase, input.userId)
        return { status: "ok" as const, projects: projects.slice(0, request.limit), total: projects.length }
      }
      if (request.action === "list_templates") {
        const templates = await listSlideshowTemplates(input.supabase, input.userId)
        return { status: "ok" as const, templates: templates.slice(0, request.limit), total: templates.length }
      }
      if (request.action === "get_project") {
        const project = await getSlideshowProject(input.supabase, input.userId, request.projectId)
        return project
          ? { status: "ok" as const, project, editUrl: `/slideshows?project=${project.id}` }
          : { status: "error" as const, message: "Slideshow project not found." }
      }

      let project = await createAndResolveSlideshow(input.supabase, input.userId, request)
      if (input.source === "automation" && project.status === "ready") {
        project = await renderSlideshowProject(input.supabase, input.userId, project.id)
      }
      return {
        status: "ok" as const,
        project,
        editUrl: `/slideshows?project=${project.id}`,
        message: input.source === "automation" && project.status === "rendered"
          ? "Created and rendered a reviewable slideshow draft."
          : "Created an editable slideshow draft.",
      }
    },
  })
}

