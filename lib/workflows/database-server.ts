import type { Node, Edge } from "@xyflow/react"
import { createClient } from "@/lib/supabase/server"

// ===== Types =====

export interface Workflow {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  nodes: Node[]
  edges: Edge[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CreateWorkflowInput {
  name: string
  description?: string
  thumbnail_url?: string
  nodes: Node[]
  edges: Edge[]
  is_public?: boolean
}

export interface UpdateWorkflowInput {
  name?: string
  description?: string
  thumbnail_url?: string
  is_public?: boolean
}

// ===== Server-side Functions (for API routes only) =====

/**
 * Create a new workflow
 */
export async function createWorkflow(
  userId: string,
  input: CreateWorkflowInput
): Promise<Workflow> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description || null,
      thumbnail_url: input.thumbnail_url || null,
      nodes: normalizeWorkflowAssetUrls(input.nodes),
      edges: input.edges,
      is_public: input.is_public || false,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating workflow:", error)
    throw new Error(`Failed to create workflow: ${error.message}`)
  }

  return denormalizeWorkflow(data)
}

/**
 * List all workflows for a user (their own + public ones)
 */
export async function listUserWorkflows(userId: string): Promise<Workflow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error fetching workflows:", error)
    throw new Error(`Failed to fetch workflows: ${error.message}`)
  }

  return data.map(denormalizeWorkflow)
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflow(workflowId: string, userId: string): Promise<Workflow> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .single()

  if (error) {
    console.error("Error fetching workflow:", error)
    throw new Error(`Failed to fetch workflow: ${error.message}`)
  }

  return denormalizeWorkflow(data)
}

/**
 * Update a workflow (user must be the owner)
 */
export async function updateWorkflow(
  workflowId: string,
  userId: string,
  input: UpdateWorkflowInput
): Promise<Workflow> {
  const supabase = await createClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from("workflows")
    .select("user_id")
    .eq("id", workflowId)
    .single()

  if (!existing || existing.user_id !== userId) {
    throw new Error("Workflow not found or access denied")
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.thumbnail_url !== undefined) updates.thumbnail_url = input.thumbnail_url
  if (input.is_public !== undefined) updates.is_public = input.is_public

  const { data, error } = await supabase
    .from("workflows")
    .update(updates)
    .eq("id", workflowId)
    .select()
    .single()

  if (error) {
    console.error("Error updating workflow:", error)
    throw new Error(`Failed to update workflow: ${error.message}`)
  }

  return denormalizeWorkflow(data)
}

/**
 * Delete a workflow (user must be the owner)
 */
export async function deleteWorkflow(workflowId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  // Verify ownership and get thumbnail URL
  const { data: existing } = await supabase
    .from("workflows")
    .select("user_id, thumbnail_url")
    .eq("id", workflowId)
    .single()

  if (!existing || existing.user_id !== userId) {
    throw new Error("Workflow not found or access denied")
  }

  // Delete thumbnail from storage if it exists
  if (existing.thumbnail_url) {
    const match = existing.thumbnail_url.match(/\/public-bucket\/(.+)/)
    const thumbnailPath = match ? match[1] : null
    if (thumbnailPath) {
      await supabase.storage.from("public-bucket").remove([thumbnailPath])
    }
  }

  // Delete workflow
  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", workflowId)

  if (error) {
    console.error("Error deleting workflow:", error)
    throw new Error(`Failed to delete workflow: ${error.message}`)
  }
}

/**
 * Upload workflow thumbnail to Supabase Storage
 */
export async function uploadWorkflowThumbnail(
  userId: string,
  workflowId: string,
  file: File
): Promise<string> {
  const supabase = await createClient()

  const fileExt = file.name.split(".").pop()
  const fileName = `${userId}/workflow-thumbnails/${workflowId}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.error("Error uploading thumbnail:", uploadError)
    throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
  }

  const { data } = supabase.storage
    .from("public-bucket")
    .getPublicUrl(fileName)

  return data.publicUrl
}

// ===== Helper Functions =====

/**
 * Normalize Supabase asset URLs to relative paths for storage
 */
function normalizeWorkflowAssetUrls(nodes: Node[]): Node[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return nodes

  return nodes.map((node) => {
    const data = { ...node.data }

    // Normalize URLs in node data
    if (data.result && typeof data.result === "string" && data.result.startsWith(supabaseUrl)) {
      data.result = data.result.replace(supabaseUrl + "/storage/v1/object/public/", "")
    }

    return { ...node, data }
  })
}

/**
 * Denormalize relative paths back to full Supabase URLs
 */
function denormalizeWorkflow(workflow: Workflow): Workflow {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return workflow

  const nodes = workflow.nodes.map((node) => {
    const data = { ...node.data }

    // Denormalize URLs in node data
    if (data.result && typeof data.result === "string" && !data.result.startsWith("http")) {
      data.result = `${supabaseUrl}/storage/v1/object/public/${data.result}`
    }

    return { ...node, data }
  })

  return { ...workflow, nodes }
}
