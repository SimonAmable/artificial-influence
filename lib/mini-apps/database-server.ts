import type { Edge, Node } from "@xyflow/react"
import { createClient } from "@/lib/supabase/server"
import type {
  CreateMiniAppInput,
  MiniApp,
  UpdateMiniAppInput,
} from "@/lib/mini-apps/types"

export async function createMiniApp(userId: string, input: CreateMiniAppInput): Promise<MiniApp> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("mini_apps")
    .insert({
      user_id: userId,
      workflow_id: input.workflow_id,
      workflow_version: input.workflow_version,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      status: input.status ?? "published",
      featured_output_node_id: input.featured_output_node_id ?? null,
      node_config: input.node_config,
      snapshot_nodes: input.snapshot_nodes,
      snapshot_edges: input.snapshot_edges,
    })
    .select("*")
    .single()

  if (error) {
    console.error("Error creating mini app:", error)
    throw new Error(`Failed to create mini app: ${error.message}`)
  }

  return data as MiniApp
}

export async function updateMiniApp(
  miniAppId: string,
  userId: string,
  input: UpdateMiniAppInput
): Promise<MiniApp> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("mini_apps")
    .select("user_id")
    .eq("id", miniAppId)
    .single()

  if (!existing || existing.user_id !== userId) {
    throw new Error("Mini app not found or access denied")
  }

  const updates: Record<string, unknown> = {}
  if (input.workflow_version !== undefined) updates.workflow_version = input.workflow_version
  if (input.name !== undefined) updates.name = input.name
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.description !== undefined) updates.description = input.description
  if (input.thumbnail_url !== undefined) updates.thumbnail_url = input.thumbnail_url
  if (input.status !== undefined) updates.status = input.status
  if (input.featured_output_node_id !== undefined) {
    updates.featured_output_node_id = input.featured_output_node_id
  }
  if (input.node_config !== undefined) updates.node_config = input.node_config
  if (input.snapshot_nodes !== undefined) updates.snapshot_nodes = input.snapshot_nodes
  if (input.snapshot_edges !== undefined) updates.snapshot_edges = input.snapshot_edges

  const { data, error } = await supabase
    .from("mini_apps")
    .update(updates)
    .eq("id", miniAppId)
    .select("*")
    .single()

  if (error) {
    console.error("Error updating mini app:", error)
    throw new Error(`Failed to update mini app: ${error.message}`)
  }

  return data as MiniApp
}

export async function getMiniAppById(miniAppId: string, userId: string): Promise<MiniApp> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("mini_apps")
    .select("*")
    .eq("id", miniAppId)
    .or(`user_id.eq.${userId},status.eq.published`)
    .single()

  if (error) {
    console.error("Error fetching mini app:", error)
    throw new Error(`Failed to fetch mini app: ${error.message}`)
  }

  return data as MiniApp
}

export async function getPublishedMiniAppBySlug(slug: string): Promise<MiniApp | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("mini_apps")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (error) {
    console.error("Error fetching mini app by slug:", error)
    throw new Error(`Failed to fetch mini app: ${error.message}`)
  }

  return (data as MiniApp | null) ?? null
}

export async function getUserMiniAppByWorkflowId(
  workflowId: string,
  userId: string
): Promise<MiniApp | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("mini_apps")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Error fetching mini app by workflow:", error)
    throw new Error(`Failed to fetch mini app: ${error.message}`)
  }

  return (data as MiniApp | null) ?? null
}

export async function listUserMiniApps(userId: string): Promise<MiniApp[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("mini_apps")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error listing mini apps:", error)
    throw new Error(`Failed to list mini apps: ${error.message}`)
  }

  return (data as MiniApp[]) ?? []
}

export function getMiniAppSnapshotNodes(miniApp: MiniApp): Node[] {
  return miniApp.snapshot_nodes as Node[]
}

export function getMiniAppSnapshotEdges(miniApp: MiniApp): Edge[] {
  return miniApp.snapshot_edges as Edge[]
}
