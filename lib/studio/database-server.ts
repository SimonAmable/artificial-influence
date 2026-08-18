import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_STUDIO_VIEWPORT,
  type CreateStudioBoardItemInput,
  type CreateStudioProjectInput,
  type StudioBoardItem,
  type StudioBoardItemSource,
  type StudioProject,
  type StudioViewport,
  type UpdateStudioBoardItemInput,
  type UpdateStudioProjectInput,
} from "@/lib/studio/types"

function normalizeViewport(raw: unknown): StudioViewport {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STUDIO_VIEWPORT }
  const value = raw as Record<string, unknown>
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : 0
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : 0
  const zoom =
    typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom > 0
      ? value.zoom
      : 1
  return { x, y, zoom }
}

function mapProject(row: Record<string, unknown>): StudioProject {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Untitled Studio",
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    viewport: normalizeViewport(row.viewport),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function listStudioProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudioProject[]> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to list studio projects: ${error.message}`)
  }

  return (data ?? []).map((row) => mapProject(row as Record<string, unknown>))
}

export async function getStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<StudioProject | null> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio project: ${error.message}`)
  }

  return data ? mapProject(data as Record<string, unknown>) : null
}

export async function createStudioProject(
  supabase: SupabaseClient,
  userId: string,
  input: CreateStudioProjectInput = {},
): Promise<StudioProject> {
  const { data, error } = await supabase
    .from("studio_projects")
    .insert({
      user_id: userId,
      name: input.name?.trim() || "Untitled Studio",
      viewport: input.viewport ?? DEFAULT_STUDIO_VIEWPORT,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create studio project: ${error?.message ?? "Unknown error"}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function updateStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  input: UpdateStudioProjectInput,
): Promise<StudioProject> {
  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string") {
    patch.name = input.name.trim() || "Untitled Studio"
  }
  if (input.thumbnail_url !== undefined) {
    patch.thumbnail_url = input.thumbnail_url
  }
  if (input.viewport) {
    patch.viewport = normalizeViewport(input.viewport)
  }

  const { data, error } = await supabase
    .from("studio_projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update studio project: ${error?.message ?? "Unknown error"}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function deleteStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("studio_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete studio project: ${error.message}`)
  }
}

export async function assertStudioProjectOwned(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify studio project: ${error.message}`)
  }

  return Boolean(data)
}

const BOARD_ITEM_SOURCES: StudioBoardItemSource[] = ["upload", "asset", "history", "paste"]

function isBoardItemSource(value: unknown): value is StudioBoardItemSource {
  return typeof value === "string" && BOARD_ITEM_SOURCES.includes(value as StudioBoardItemSource)
}

function mapBoardItem(row: Record<string, unknown>): StudioBoardItem {
  const kind = row.kind === "video" ? "video" : "image"
  return {
    id: String(row.id),
    studio_project_id: String(row.studio_project_id),
    user_id: String(row.user_id),
    kind,
    url: String(row.url),
    source: isBoardItemSource(row.source) ? row.source : "upload",
    source_id: typeof row.source_id === "string" ? row.source_id : null,
    prompt: typeof row.prompt === "string" ? row.prompt : null,
    x: typeof row.x === "number" && Number.isFinite(row.x) ? row.x : 0,
    y: typeof row.y === "number" && Number.isFinite(row.y) ? row.y : 0,
    width: typeof row.width === "number" && row.width > 0 ? row.width : 280,
    height: typeof row.height === "number" && row.height > 0 ? row.height : 280,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function listStudioBoardItems(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<StudioBoardItem[]> {
  const owned = await assertStudioProjectOwned(supabase, userId, projectId)
  if (!owned) {
    throw new Error("Studio project not found")
  }

  const { data, error } = await supabase
    .from("studio_board_items")
    .select("*")
    .eq("studio_project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to list studio board items: ${error.message}`)
  }

  return (data ?? []).map((row) => mapBoardItem(row as Record<string, unknown>))
}

export async function createStudioBoardItems(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  inputs: CreateStudioBoardItemInput[],
): Promise<StudioBoardItem[]> {
  if (inputs.length === 0) return []

  const owned = await assertStudioProjectOwned(supabase, userId, projectId)
  if (!owned) {
    throw new Error("Studio project not found")
  }

  const rows = inputs.map((input) => ({
    studio_project_id: projectId,
    user_id: userId,
    kind: input.kind === "video" ? "video" : "image",
    url: input.url.trim(),
    source: isBoardItemSource(input.source) ? input.source : "upload",
    source_id: input.source_id?.trim() || null,
    prompt: input.prompt?.trim() || null,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
  }))

  if (rows.some((row) => !row.url || row.width <= 0 || row.height <= 0)) {
    throw new Error("Each board item needs a URL and size")
  }

  const { data, error } = await supabase
    .from("studio_board_items")
    .insert(rows)
    .select("*")

  if (error || !data) {
    throw new Error(`Failed to add studio board items: ${error?.message ?? "Unknown error"}`)
  }

  return data.map((row) => mapBoardItem(row as Record<string, unknown>))
}

export async function updateStudioBoardItem(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  itemId: string,
  input: UpdateStudioBoardItemInput,
): Promise<StudioBoardItem> {
  const patch: Record<string, unknown> = {}
  if (typeof input.x === "number" && Number.isFinite(input.x)) patch.x = input.x
  if (typeof input.y === "number" && Number.isFinite(input.y)) patch.y = input.y
  if (typeof input.width === "number" && input.width > 0) patch.width = input.width
  if (typeof input.height === "number" && input.height > 0) patch.height = input.height
  if (input.prompt !== undefined) patch.prompt = input.prompt?.trim() || null

  if (Object.keys(patch).length === 0) {
    throw new Error("No board item fields to update")
  }

  const { data, error } = await supabase
    .from("studio_board_items")
    .update(patch)
    .eq("id", itemId)
    .eq("studio_project_id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update studio board item: ${error?.message ?? "Unknown error"}`)
  }

  return mapBoardItem(data as Record<string, unknown>)
}

export async function deleteStudioBoardItem(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from("studio_board_items")
    .delete()
    .eq("id", itemId)
    .eq("studio_project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete studio board item: ${error.message}`)
  }
}
