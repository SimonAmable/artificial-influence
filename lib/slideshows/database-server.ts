import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseProjectSlides, parseSlideshowBlueprint } from "@/lib/slideshows/template-builder-utils"
import {
  slideshowAspectRatioSchema,
  slideshowBlueprintSchema,
  slideshowProjectSlidesSchema,
  slideshowProjectStatusSchema,
  slideshowTemplateOriginSchema,
  type ResolvedSlideshowSlide,
  type SlideshowAspectRatio,
  type SlideshowBlueprint,
  type SlideshowProject,
  type SlideshowProjectStatus,
  type SlideshowTemplate,
} from "@/lib/slideshows/types"

const templateSelect =
  "id, user_id, name, description, thumbnail_url, is_public, origin, current_version, created_at, updated_at"
const versionSelect = "id, template_id, version, aspect_ratio, blueprint, created_at"
const projectSelect =
  "id, user_id, template_id, template_version_id, brand_kit_id, name, brief, aspect_ratio, status, slides, rendered_slide_urls, error_message, created_at, updated_at"

type TemplateRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  is_public: boolean
  origin: string
  current_version: number
  created_at: string
  updated_at: string
}

type VersionRow = {
  id: string
  template_id: string
  version: number
  aspect_ratio: string
  blueprint: unknown
  created_at: string
}

type ProjectRow = {
  id: string
  user_id: string
  template_id: string
  template_version_id: string
  brand_kit_id: string | null
  name: string
  brief: string
  aspect_ratio: string
  status: string
  slides: unknown
  rendered_slide_urls: string[] | null
  error_message: string | null
  created_at: string
  updated_at: string
}

function mapTemplate(row: TemplateRow, version: VersionRow): SlideshowTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    isPublic: row.is_public,
    origin: slideshowTemplateOriginSchema.parse(row.origin),
    currentVersion: row.current_version,
    versionId: version.id,
    aspectRatio: slideshowAspectRatioSchema.parse(version.aspect_ratio),
    blueprint: parseSlideshowBlueprint(version.blueprint),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProject(row: ProjectRow): SlideshowProject {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    templateVersionId: row.template_version_id,
    brandKitId: row.brand_kit_id,
    name: row.name,
    brief: row.brief,
    aspectRatio: slideshowAspectRatioSchema.parse(row.aspect_ratio),
    status: slideshowProjectStatusSchema.parse(row.status),
    slides: parseProjectSlides(row.slides),
    renderedSlideUrls: Array.isArray(row.rendered_slide_urls) ? row.rendered_slide_urls : [],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getVersionsByTemplateIds(supabase: SupabaseClient, templateRows: TemplateRow[]) {
  if (templateRows.length === 0) return new Map<string, VersionRow>()
  const { data, error } = await supabase
    .from("slideshow_template_versions")
    .select(versionSelect)
    .in("template_id", templateRows.map((row) => row.id))

  if (error) throw new Error(`Failed to load slideshow template versions: ${error.message}`)
  const wanted = new Map(templateRows.map((row) => [row.id, row.current_version]))
  return new Map(
    ((data ?? []) as VersionRow[])
      .filter((row) => wanted.get(row.template_id) === row.version)
      .map((row) => [row.template_id, row]),
  )
}

export async function listSlideshowTemplates(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("slideshow_templates")
    .select(templateSelect)
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(`Failed to load slideshow templates: ${error.message}`)
  const rows = (data ?? []) as TemplateRow[]
  const versions = await getVersionsByTemplateIds(supabase, rows)
  return rows.flatMap((row) => {
    const version = versions.get(row.id)
    return version ? [mapTemplate(row, version)] : []
  })
}

export async function getSlideshowTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_templates")
    .select(templateSelect)
    .eq("id", templateId)
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .maybeSingle()
  if (error) throw new Error(`Failed to load slideshow template: ${error.message}`)
  if (!data) return null

  const row = data as TemplateRow
  const { data: version, error: versionError } = await supabase
    .from("slideshow_template_versions")
    .select(versionSelect)
    .eq("template_id", row.id)
    .eq("version", row.current_version)
    .single()
  if (versionError || !version) throw new Error(versionError?.message || "Template version not found.")
  return mapTemplate(row, version as VersionRow)
}

export async function createSlideshowTemplate(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string
    description?: string | null
    origin?: "generated" | "saved" | "starter" | "cloned"
    isPublic?: boolean
    aspectRatio: SlideshowAspectRatio
    blueprint: SlideshowBlueprint
  },
) {
  const { data: template, error } = await supabase
    .from("slideshow_templates")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      origin: input.origin ?? "generated",
      is_public: input.isPublic ?? false,
      current_version: 1,
    })
    .select(templateSelect)
    .single()
  if (error || !template) throw new Error(error?.message || "Failed to create slideshow template.")

  const { data: version, error: versionError } = await supabase
    .from("slideshow_template_versions")
    .insert({
      template_id: template.id,
      version: 1,
      aspect_ratio: input.aspectRatio,
      blueprint: slideshowBlueprintSchema.parse(input.blueprint),
    })
    .select(versionSelect)
    .single()
  if (versionError || !version) throw new Error(versionError?.message || "Failed to create template version.")
  return mapTemplate(template as TemplateRow, version as VersionRow)
}

export async function cloneSlideshowTemplate(
  supabase: SupabaseClient,
  userId: string,
  template: SlideshowTemplate,
) {
  return createSlideshowTemplate(supabase, userId, {
    name: `${template.name} copy`,
    description: template.description,
    origin: "cloned",
    aspectRatio: template.aspectRatio,
    blueprint: template.blueprint,
  })
}

export async function updateSlideshowTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
  input: {
    name?: string
    description?: string | null
    aspectRatio?: SlideshowAspectRatio
    blueprint?: SlideshowBlueprint
  },
) {
  const existing = await getSlideshowTemplate(supabase, userId, templateId)
  if (!existing || existing.userId !== userId) {
    throw new Error("Template not found.")
  }

  const nextVersion = existing.currentVersion + 1
  const aspectRatio = input.aspectRatio ?? existing.aspectRatio
  const blueprint = input.blueprint ?? existing.blueprint

  const { data: version, error: versionError } = await supabase
    .from("slideshow_template_versions")
    .insert({
      template_id: templateId,
      version: nextVersion,
      aspect_ratio: aspectRatio,
      blueprint: slideshowBlueprintSchema.parse(blueprint),
    })
    .select(versionSelect)
    .single()
  if (versionError || !version) {
    throw new Error(versionError?.message || "Failed to create template version.")
  }

  const templateUpdates: Record<string, unknown> = {
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) templateUpdates.name = input.name.trim()
  if (input.description !== undefined) templateUpdates.description = input.description?.trim() || null

  const { data: template, error } = await supabase
    .from("slideshow_templates")
    .update(templateUpdates)
    .eq("id", templateId)
    .eq("user_id", userId)
    .select(templateSelect)
    .single()
  if (error || !template) throw new Error(error?.message || "Failed to update slideshow template.")

  return mapTemplate(template as TemplateRow, version as VersionRow)
}

export async function listSlideshowProjects(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("slideshow_projects")
    .select(projectSelect)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(`Failed to load slideshow projects: ${error.message}`)
  return ((data ?? []) as ProjectRow[]).map(mapProject)
}

export async function getSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_projects")
    .select(projectSelect)
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load slideshow project: ${error.message}`)
  return data ? mapProject(data as ProjectRow) : null
}

export async function createSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  input: {
    template: SlideshowTemplate
    brief: string
    brandKitId?: string | null
    name?: string
    slides: ResolvedSlideshowSlide[]
  },
) {
  const { data, error } = await supabase
    .from("slideshow_projects")
    .insert({
      user_id: userId,
      template_id: input.template.id,
      template_version_id: input.template.versionId,
      brand_kit_id: input.brandKitId ?? null,
      name: input.name?.trim() || input.template.name,
      brief: input.brief.trim(),
      aspect_ratio: input.template.aspectRatio,
      status: "resolving",
      slides: slideshowProjectSlidesSchema.parse(input.slides),
    })
    .select(projectSelect)
    .single()
  if (error || !data) throw new Error(error?.message || "Failed to create slideshow project.")
  return mapProject(data as ProjectRow)
}

export async function updateSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  input: {
    name?: string
    status?: SlideshowProjectStatus
    slides?: ResolvedSlideshowSlide[]
    renderedSlideUrls?: string[]
    errorMessage?: string | null
  },
) {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.status !== undefined) updates.status = slideshowProjectStatusSchema.parse(input.status)
  if (input.slides !== undefined) updates.slides = slideshowProjectSlidesSchema.parse(input.slides)
  if (input.renderedSlideUrls !== undefined) updates.rendered_slide_urls = input.renderedSlideUrls
  if (input.errorMessage !== undefined) updates.error_message = input.errorMessage

  const { data, error } = await supabase
    .from("slideshow_projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select(projectSelect)
    .single()
  if (error || !data) throw new Error(error?.message || "Failed to update slideshow project.")
  return mapProject(data as ProjectRow)
}

