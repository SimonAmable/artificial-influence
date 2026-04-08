import { createClient } from "@/lib/supabase/server"
import type {
  CreateEditorProjectInput,
  EditorProject,
  EditorProjectSummary,
  EditorRenderJob,
  UpdateEditorProjectInput,
} from "@/lib/editor/types"
import { createDefaultProjectInput } from "@/lib/editor/utils"

function mapProject(row: Record<string, unknown>): EditorProject {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    composition_settings: row.composition_settings as EditorProject["composition_settings"],
    timeline_state: row.timeline_state as EditorProject["timeline_state"],
    last_opened_at: (row.last_opened_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    last_render_status:
      (row.last_render_status as EditorProject["last_render_status"] | null) ??
      "idle",
    last_rendered_at: (row.last_rendered_at as string | null) ?? null,
  }
}

export async function createEditorProject(
  userId: string,
  input: CreateEditorProjectInput = {},
): Promise<EditorProject> {
  const supabase = await createClient()
  const defaults = createDefaultProjectInput(input.name || "Untitled Project")
  const { data, error } = await supabase
    .from("editor_projects")
    .insert({
      user_id: userId,
      name: input.name || defaults.name,
      description: input.description ?? defaults.description,
      thumbnail_url: input.thumbnail_url ?? defaults.thumbnail_url,
      composition_settings:
        input.composition_settings ?? defaults.composition_settings,
      timeline_state: input.timeline_state ?? defaults.timeline_state,
      last_render_status: "idle",
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("Error creating editor project:", error)
    throw new Error(`Failed to create editor project: ${error?.message}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function listEditorProjects(
  userId: string,
): Promise<EditorProjectSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("editor_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error listing editor projects:", error)
    throw new Error(`Failed to list editor projects: ${error.message}`)
  }

  return (data as Record<string, unknown>[]).map((row) => {
    const project = mapProject(row)
    return {
      ...project,
      duration_in_frames: project.composition_settings.durationInFrames,
    }
  })
}

export async function loadEditorProject(
  projectId: string,
  userId: string,
): Promise<EditorProject | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("editor_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    console.error("Error loading editor project:", error)
    throw new Error(`Failed to load editor project: ${error.message}`)
  }

  await supabase
    .from("editor_projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId)

  return mapProject(data as Record<string, unknown>)
}

export async function updateEditorProject(
  projectId: string,
  userId: string,
  updates: UpdateEditorProjectInput,
): Promise<EditorProject> {
  const supabase = await createClient()
  const updateData: Record<string, unknown> = {}

  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.thumbnail_url !== undefined) updateData.thumbnail_url = updates.thumbnail_url
  if (updates.composition_settings !== undefined) {
    updateData.composition_settings = updates.composition_settings
  }
  if (updates.timeline_state !== undefined) {
    updateData.timeline_state = updates.timeline_state
  }
  if (updates.last_render_status !== undefined) {
    updateData.last_render_status = updates.last_render_status
  }
  if (updates.last_rendered_at !== undefined) {
    updateData.last_rendered_at = updates.last_rendered_at
  }

  const { data, error } = await supabase
    .from("editor_projects")
    .update(updateData)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("Error updating editor project:", error)
    throw new Error(`Failed to update editor project: ${error?.message}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function deleteEditorProject(
  projectId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient()

  await supabase.from("editor_renders").delete().eq("project_id", projectId).eq("user_id", userId)

  const { error } = await supabase
    .from("editor_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error deleting editor project:", error)
    throw new Error(`Failed to delete editor project: ${error.message}`)
  }
}

export async function duplicateEditorProject(
  projectId: string,
  userId: string,
): Promise<EditorProject> {
  const source = await loadEditorProject(projectId, userId)
  if (!source) {
    throw new Error("Editor project not found")
  }

  return createEditorProject(userId, {
    name: `${source.name} (Copy)`,
    description: source.description,
    thumbnail_url: source.thumbnail_url,
    composition_settings: source.composition_settings,
    timeline_state: source.timeline_state,
  })
}


export async function createEditorRenderJob(
  projectId: string,
  userId: string,
  metadata: Record<string, unknown> = {},
): Promise<EditorRenderJob> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("editor_renders")
    .insert({
      project_id: projectId,
      user_id: userId,
      status: "queued",
      provider: "adapter",
      provider_job_id: null,
      output_url: null,
      output_asset_id: null,
      error_message: null,
      metadata,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("Error creating editor render job:", error)
    throw new Error(`Failed to create editor render job: ${error?.message}`)
  }

  await updateEditorProject(projectId, userId, {
    last_render_status: "queued",
  })

  return data as EditorRenderJob
}

export async function getEditorRenderJob(
  renderId: string,
  userId: string,
): Promise<EditorRenderJob | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("editor_renders")
    .select("*")
    .eq("id", renderId)
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    console.error("Error loading editor render job:", error)
    throw new Error(`Failed to load editor render job: ${error.message}`)
  }

  return data as EditorRenderJob
}

export async function updateEditorRenderJob(
  renderId: string,
  userId: string,
  updates: Partial<
    Pick<
      EditorRenderJob,
      | "status"
      | "provider_job_id"
      | "output_url"
      | "output_asset_id"
      | "error_message"
      | "metadata"
      | "completed_at"
    >
  >,
): Promise<EditorRenderJob> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("editor_renders")
    .update({
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.provider_job_id !== undefined
        ? { provider_job_id: updates.provider_job_id }
        : {}),
      ...(updates.output_url !== undefined ? { output_url: updates.output_url } : {}),
      ...(updates.output_asset_id !== undefined
        ? { output_asset_id: updates.output_asset_id }
        : {}),
      ...(updates.error_message !== undefined
        ? { error_message: updates.error_message }
        : {}),
      ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
      ...(updates.completed_at !== undefined
        ? { completed_at: updates.completed_at }
        : {}),
    })
    .eq("id", renderId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("Error updating editor render job:", error)
    throw new Error(`Failed to update editor render job: ${error?.message}`)
  }

  return data as EditorRenderJob
}
