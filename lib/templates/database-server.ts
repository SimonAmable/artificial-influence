import { createClient } from "@/lib/supabase/server"
import type {
  CreateTemplateInput,
  Template,
  TemplatePromptAttachment,
  TemplateHiddenContext,
  TemplateRun,
  TemplateRunStatus,
  UpdateTemplateInput,
} from "@/lib/templates/types"
import { normalizeTemplateInputs } from "@/lib/templates/input-utils"
import { guessCreditsCost } from "@/lib/templates/types"
import type { TemplateInputValues } from "@/lib/templates/prompt-filler"
import { currentProduct } from "@/lib/product/current"

function mapTemplateRow(row: Record<string, unknown>): Template {
  const promptAttachments = Array.isArray(row.prompt_attachments)
    ? row.prompt_attachments
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          url: typeof item.url === "string" ? item.url : "",
          title: typeof item.title === "string" ? item.title : null,
        }))
        .filter((item) => item.url.length > 0)
    : []

  return {
    ...(row as Omit<Template, "inputs">),
    prompt_attachments: promptAttachments as TemplatePromptAttachment[],
    inputs: normalizeTemplateInputs(row.inputs),
    product_ids: Array.isArray(row.product_ids)
      ? row.product_ids.filter((item): item is string => typeof item === "string")
      : ["unican"],
  }
}

function scopeTemplatesToCurrentProduct<T extends { contains: (column: string, value: string[]) => T }>(
  query: T,
): T {
  return query.contains("product_ids", [currentProduct.id])
}

export async function createTemplate(
  userId: string,
  input: CreateTemplateInput,
): Promise<Template> {
  const supabase = await createClient()
  const creditsCost = input.credits_cost ?? guessCreditsCost(input.output_kind)

  const { data, error } = await supabase
    .from("templates")
    .insert({
      creator_id: userId,
      slug: input.slug,
      title: input.title,
      description: input.description ?? "",
      tips: input.tips ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      thumbnail_kind: input.thumbnail_kind ?? "image",
      category: input.category,
      prompt: input.prompt,
      prompt_attachments: input.prompt_attachments ?? [],
      output_kind: input.output_kind,
      inputs: input.inputs,
      credits_cost: creditsCost,
      visibility: input.visibility ?? "private",
      product_ids: [currentProduct.id],
    })
    .select("*")
    .single()

  if (error) {
    console.error("Error creating template:", error)
    throw new Error(`Failed to create template: ${error.message}`)
  }

  return mapTemplateRow(data as Record<string, unknown>)
}

export async function updateTemplate(
  templateId: string,
  userId: string,
  input: UpdateTemplateInput,
): Promise<Template> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("templates")
    .select("creator_id")
    .eq("id", templateId)
    .contains("product_ids", [currentProduct.id])
    .single()

  if (!existing || existing.creator_id !== userId) {
    throw new Error("Template not found or access denied")
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.tips !== undefined) updates.tips = input.tips
  if (input.thumbnail_url !== undefined) updates.thumbnail_url = input.thumbnail_url
  if (input.thumbnail_kind !== undefined) updates.thumbnail_kind = input.thumbnail_kind
  if (input.category !== undefined) updates.category = input.category
  if (input.prompt !== undefined) updates.prompt = input.prompt
  if (input.prompt_attachments !== undefined) updates.prompt_attachments = input.prompt_attachments
  if (input.output_kind !== undefined) updates.output_kind = input.output_kind
  if (input.inputs !== undefined) updates.inputs = input.inputs
  if (input.credits_cost !== undefined) updates.credits_cost = input.credits_cost
  if (input.credits_cost_locked !== undefined) updates.credits_cost_locked = input.credits_cost_locked
  if (input.visibility !== undefined) updates.visibility = input.visibility
  if (input.product_ids !== undefined) updates.product_ids = input.product_ids

  const { data, error } = await supabase
    .from("templates")
    .update(updates)
    .eq("id", templateId)
    .select("*")
    .single()

  if (error) {
    console.error("Error updating template:", error)
    throw new Error(`Failed to update template: ${error.message}`)
  }

  return mapTemplateRow(data as Record<string, unknown>)
}

export async function deleteTemplate(templateId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("creator_id", userId)
    .contains("product_ids", [currentProduct.id])

  if (error) {
    console.error("Error deleting template:", error)
    throw new Error(`Failed to delete template: ${error.message}`)
  }
}

export async function getTemplateById(
  templateId: string,
  userId?: string,
): Promise<Template | null> {
  const supabase = await createClient()

  let query = scopeTemplatesToCurrentProduct(
    supabase.from("templates").select("*").eq("id", templateId),
  )

  if (userId) {
    query = query.or(`visibility.eq.public,creator_id.eq.${userId}`)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error("Error fetching template:", error)
    throw new Error(`Failed to fetch template: ${error.message}`)
  }

  return data ? mapTemplateRow(data as Record<string, unknown>) : null
}

export async function getTemplateBySlugForUser(
  slug: string,
  userId?: string | null,
): Promise<Template | null> {
  const supabase = await createClient()

  const { data, error } = await scopeTemplatesToCurrentProduct(
    supabase.from("templates").select("*").eq("slug", slug),
  ).maybeSingle()

  if (error) {
    console.error("Error fetching template by slug:", error)
    throw new Error(`Failed to fetch template: ${error.message}`)
  }

  if (!data) return null

  const template = mapTemplateRow(data as Record<string, unknown>)
  if (template.visibility === "public") return template
  if (userId && template.creator_id === userId) return template
  return null
}

export async function listPublicTemplates(category?: string): Promise<Template[]> {
  const supabase = await createClient()

  let query = scopeTemplatesToCurrentProduct(supabase
    .from("templates")
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false }))

  if (category && category !== "all") {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error listing public templates:", error)
    throw new Error(`Failed to list templates: ${error.message}`)
  }

  return ((data as Record<string, unknown>[]) ?? []).map(mapTemplateRow)
}

export async function listTemplatesForGallery(
  userId?: string | null,
  category?: string,
  search?: string,
): Promise<Template[]> {
  const supabase = await createClient()

  let query = scopeTemplatesToCurrentProduct(supabase
    .from("templates")
    .select("*")
    .order("updated_at", { ascending: false }))

  if (userId) {
    query = query.or(`visibility.eq.public,creator_id.eq.${userId}`)
  } else {
    query = query.eq("visibility", "public")
  }

  if (category && category !== "all") {
    query = query.eq("category", category)
  }

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    const safeSearch = trimmedSearch.replace(/[%_,()'":;]/g, " ").replace(/\s+/g, " ").trim()
    if (safeSearch) {
      query = query.or(
        `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`,
      )
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("Error listing gallery templates:", error)
    throw new Error(`Failed to list templates: ${error.message}`)
  }

  return ((data as Record<string, unknown>[]) ?? []).map(mapTemplateRow)
}

export async function listUserTemplates(userId: string): Promise<Template[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("creator_id", userId)
    .contains("product_ids", [currentProduct.id])
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error listing user templates:", error)
    throw new Error(`Failed to list templates: ${error.message}`)
  }

  return ((data as Record<string, unknown>[]) ?? []).map(mapTemplateRow)
}

export async function searchTemplatesForUser(
  userId: string,
  options?: {
    query?: string
    scope?: "mine" | "public" | "all"
    category?: string
    limit?: number
  },
): Promise<Template[]> {
  const scope = options?.scope ?? "all"
  const category = options?.category ?? "all"
  const limit = options?.limit ?? 8

  const templates =
    scope === "mine"
      ? await listUserTemplates(userId)
      : scope === "public"
        ? await listPublicTemplates(category)
        : await listTemplatesForGallery(userId, category, options?.query)

  const query = options?.query?.trim().toLowerCase()
  const filtered = query && scope !== "all"
    ? templates.filter((template) =>
        [template.title, template.description, template.slug].some((value) =>
          value.toLowerCase().includes(query),
        ),
      )
    : templates

  return filtered.slice(0, limit)
}

export async function createTemplateRun(input: {
  templateId: string
  threadId: string
  userId: string
  inputValues: TemplateInputValues
  templateContext: TemplateHiddenContext
  creditsEstimated: number
}): Promise<TemplateRun> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("template_runs")
    .insert({
      template_id: input.templateId,
      thread_id: input.threadId,
      user_id: input.userId,
      input_values: input.inputValues,
      template_context: input.templateContext,
      credits_estimated: input.creditsEstimated,
      status: "pending",
    })
    .select("*")
    .single()

  if (error) {
    console.error("Error creating template run:", error)
    throw new Error(`Failed to create template run: ${error.message}`)
  }

  const { data: templateRow } = await supabase
    .from("templates")
    .select("run_count")
    .eq("id", input.templateId)
    .single()

  if (templateRow) {
    await supabase
      .from("templates")
      .update({ run_count: (templateRow.run_count ?? 0) + 1 })
      .eq("id", input.templateId)
  }

  return data as TemplateRun
}

export async function getTemplateRunByThreadId(threadId: string): Promise<
  (TemplateRun & { template: Pick<Template, "id" | "credits_cost_locked" | "credits_cost"> }) | null
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("template_runs")
    .select("*, templates(id, credits_cost_locked, credits_cost)")
    .eq("thread_id", threadId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching template run:", error)
    return null
  }

  if (!data) return null

  const row = data as TemplateRun & {
    templates: Pick<Template, "id" | "credits_cost_locked" | "credits_cost"> | null
  }

  if (!row.templates) return null

  return {
    ...row,
    template: row.templates,
  }
}

export async function completeTemplateRun(
  threadId: string,
  status: TemplateRunStatus,
  creditsActual: number | null,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("template_runs")
    .update({
      status,
      credits_actual: creditsActual,
      completed_at: new Date().toISOString(),
    })
    .eq("thread_id", threadId)

  if (error) {
    console.error("Error completing template run:", error)
  }
}

export async function calibrateTemplateCreditsIfNeeded(
  templateId: string,
  creditsActual: number,
  currentlyLocked: boolean,
): Promise<void> {
  if (currentlyLocked || creditsActual <= 0) return

  const supabase = await createClient()

  const { error } = await supabase
    .from("templates")
    .update({
      credits_cost: creditsActual,
      credits_cost_locked: true,
      last_run_credits: creditsActual,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("credits_cost_locked", false)

  if (error) {
    console.error("Error calibrating template credits:", error)
  }
}
