import type { Node, Edge } from "@xyflow/react"
import { createClient } from "@/lib/supabase/server"

// ===== Types =====

export interface Canvas {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  nodes: Node[]
  edges: Edge[]
  is_favorite: boolean
  last_opened_at: string | null
  last_edited_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateCanvasInput {
  name?: string
  description?: string
  nodes?: Node[]
  edges?: Edge[]
}

export interface UpdateCanvasInput {
  name?: string
  description?: string
  thumbnail_url?: string
  nodes?: Node[]
  edges?: Edge[]
  is_favorite?: boolean
}

// ===== Server-side Functions (for API routes only) =====

/**
 * Save a new canvas to the database
 */
export async function createCanvas(
  userId: string,
  input: CreateCanvasInput
): Promise<Canvas> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("canvases")
    .insert({
      user_id: userId,
      name: input.name || "Canvas",
      description: input.description || null,
      nodes: normalizeNodesForStorage(input.nodes || []),
      edges: normalizeEdgesForStorage(input.edges || []),
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating canvas:", error)
    throw new Error(`Failed to create canvas: ${error.message}`)
  }

  const canvas = data as Canvas
  canvas.nodes = denormalizeNodesFromStorage(canvas.nodes)
  canvas.edges = denormalizeEdgesFromStorage(canvas.edges)
  return canvas
}

/**
 * Load a canvas by ID (with ownership check)
 */
export async function loadCanvas(
  canvasId: string,
  userId: string
): Promise<Canvas | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("id", canvasId)
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null
    }
    console.error("Error loading canvas:", error)
    throw new Error(`Failed to load canvas: ${error.message}`)
  }

  // Denormalize asset URLs when loading
  const canvas = data as Canvas
  canvas.nodes = denormalizeNodesFromStorage(canvas.nodes)
  canvas.edges = denormalizeEdgesFromStorage(canvas.edges)

  // Update last_opened_at
  await supabase
    .from("canvases")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", canvasId)
    .eq("user_id", userId)

  return canvas
}

/**
 * Update an existing canvas
 */
export async function updateCanvas(
  canvasId: string,
  userId: string,
  updates: UpdateCanvasInput
): Promise<Canvas> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.thumbnail_url !== undefined) updateData.thumbnail_url = updates.thumbnail_url
  if (updates.is_favorite !== undefined) updateData.is_favorite = updates.is_favorite
  
  if (updates.nodes !== undefined) {
    updateData.nodes = normalizeNodesForStorage(updates.nodes)
  }
  if (updates.edges !== undefined) {
    updateData.edges = normalizeEdgesForStorage(updates.edges)
  }

  updateData.last_edited_by = userId

  const { data, error } = await supabase
    .from("canvases")
    .update(updateData)
    .eq("id", canvasId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating canvas:", error)
    throw new Error(`Failed to update canvas: ${error.message}`)
  }

  const canvas = data as Canvas
  canvas.nodes = denormalizeNodesFromStorage(canvas.nodes)
  canvas.edges = denormalizeEdgesFromStorage(canvas.edges)
  return canvas
}

/**
 * List all canvases for a user
 */
export async function listUserCanvases(userId: string): Promise<Canvas[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error listing canvases:", error)
    throw new Error(`Failed to list canvases: ${error.message}`)
  }

  return (data as Canvas[]).map((canvas) => ({
    ...canvas,
    nodes: denormalizeNodesFromStorage(canvas.nodes),
    edges: denormalizeEdgesFromStorage(canvas.edges),
  }))
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(
  canvasId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()

  // First, get the canvas to find thumbnail URL
  const { data: canvas } = await supabase
    .from("canvases")
    .select("thumbnail_url")
    .eq("id", canvasId)
    .eq("user_id", userId)
    .single()

  // Delete thumbnail from storage if it exists
  if (canvas?.thumbnail_url) {
    const path = extractStoragePath(canvas.thumbnail_url)
    if (path) {
      await supabase.storage.from("public-bucket").remove([path])
    }
  }

  // Delete canvas record
  const { error } = await supabase
    .from("canvases")
    .delete()
    .eq("id", canvasId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error deleting canvas:", error)
    throw new Error(`Failed to delete canvas: ${error.message}`)
  }
}

/**
 * Duplicate a canvas
 */
export async function duplicateCanvas(
  canvasId: string,
  userId: string
): Promise<Canvas> {
  const supabase = await createClient()

  // Load the original canvas
  const original = await loadCanvas(canvasId, userId)
  if (!original) {
    throw new Error("Canvas not found")
  }

  // Create new canvas with copied data
  const { data, error } = await supabase
    .from("canvases")
    .insert({
      user_id: userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      nodes: normalizeNodesForStorage(original.nodes),
      edges: normalizeEdgesForStorage(original.edges),
      is_favorite: false,
    })
    .select()
    .single()

  if (error) {
    console.error("Error duplicating canvas:", error)
    throw new Error(`Failed to duplicate canvas: ${error.message}`)
  }

  const canvas = data as Canvas
  canvas.nodes = denormalizeNodesFromStorage(canvas.nodes)
  canvas.edges = denormalizeEdgesFromStorage(canvas.edges)
  return canvas
}

// ===== Asset URL Normalization =====

/**
 * Normalize Supabase Storage URLs to relative paths for storage efficiency
 * Example: https://xxx.supabase.co/storage/v1/object/public/public-bucket/user-id/image.png
 * → user-id/image.png
 */
function normalizeNodesForStorage(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const data = { ...node.data }
    
    // Normalize URLs in common fields
    if (typeof data.generatedImageUrl === "string") {
      data.generatedImageUrl = normalizeUrl(data.generatedImageUrl)
    }
    if (typeof data.generatedVideoUrl === "string") {
      data.generatedVideoUrl = normalizeUrl(data.generatedVideoUrl)
    }
    if (typeof data.generatedAudioUrl === "string") {
      data.generatedAudioUrl = normalizeUrl(data.generatedAudioUrl)
    }
    if (typeof data.fileUrl === "string") {
      data.fileUrl = normalizeUrl(data.fileUrl)
    }
    if (typeof data.imageUrl === "string") {
      data.imageUrl = normalizeUrl(data.imageUrl)
    }
    if (typeof data.videoUrl === "string") {
      data.videoUrl = normalizeUrl(data.videoUrl)
    }

    return { ...node, data }
  })
}

/**
 * Denormalize storage paths back to full Supabase URLs
 */
function denormalizeNodesFromStorage(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const data = { ...node.data }
    
    // Denormalize URLs in common fields
    if (typeof data.generatedImageUrl === "string") {
      data.generatedImageUrl = denormalizeUrl(data.generatedImageUrl)
    }
    if (typeof data.generatedVideoUrl === "string") {
      data.generatedVideoUrl = denormalizeUrl(data.generatedVideoUrl)
    }
    if (typeof data.generatedAudioUrl === "string") {
      data.generatedAudioUrl = denormalizeUrl(data.generatedAudioUrl)
    }
    if (typeof data.fileUrl === "string") {
      data.fileUrl = denormalizeUrl(data.fileUrl)
    }
    if (typeof data.imageUrl === "string") {
      data.imageUrl = denormalizeUrl(data.imageUrl)
    }
    if (typeof data.videoUrl === "string") {
      data.videoUrl = denormalizeUrl(data.videoUrl)
    }

    return { ...node, data }
  })
}

/**
 * Normalize edges for storage - ensure edge types are preserved
 */
function normalizeEdgesForStorage(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    const normalized: Edge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'node-to-node',
    }
    
    // Only include handle properties if they have actual string values (not null, undefined, or "null")
    const isValidHandle = (handle: unknown): handle is string => {
      return (
        handle != null && // not null or undefined
        handle !== 'null' && // not the string "null"
        typeof handle === 'string' &&
        handle.trim().length > 0 // not empty string
      )
    }
    
    if (isValidHandle(edge.sourceHandle)) {
      normalized.sourceHandle = edge.sourceHandle
    }
    if (isValidHandle(edge.targetHandle)) {
      normalized.targetHandle = edge.targetHandle
    }
    
    // Preserve other edge properties
    if (edge.animated !== undefined) normalized.animated = edge.animated
    if (edge.style) normalized.style = edge.style
    if (edge.className) normalized.className = edge.className
    if (edge.label) normalized.label = edge.label
    if (edge.labelStyle) normalized.labelStyle = edge.labelStyle
    if (edge.labelShowBg !== undefined) normalized.labelShowBg = edge.labelShowBg
    if (edge.labelBgStyle) normalized.labelBgStyle = edge.labelBgStyle
    
    return normalized
  })
}

/**
 * Denormalize edges from storage - ensure proper React Flow structure
 */
function denormalizeEdgesFromStorage(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    // Log raw edge data to see what's actually in the database
    console.log('[denormalizeEdgesFromStorage] Raw edge:', {
      id: edge.id,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      sourceHandleType: typeof edge.sourceHandle,
      targetHandleType: typeof edge.targetHandle,
    })
    
    const denormalized: Edge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'node-to-node',
    }
    
    // Only include handle properties if they have actual string values (not null, undefined, or "null")
    const isValidHandle = (handle: unknown): handle is string => {
      return (
        handle != null && // not null or undefined
        handle !== 'null' && // not the string "null"
        typeof handle === 'string' &&
        handle.trim().length > 0 // not empty string
      )
    }
    
    if (isValidHandle(edge.sourceHandle)) {
      denormalized.sourceHandle = edge.sourceHandle
    }
    if (isValidHandle(edge.targetHandle)) {
      denormalized.targetHandle = edge.targetHandle
    }
    
    console.log('[denormalizeEdgesFromStorage] Denormalized edge:', {
      id: denormalized.id,
      hasSourceHandle: 'sourceHandle' in denormalized,
      hasTargetHandle: 'targetHandle' in denormalized,
      sourceHandle: denormalized.sourceHandle,
      targetHandle: denormalized.targetHandle,
    })
    
    // Preserve other edge properties
    if (edge.animated !== undefined) denormalized.animated = edge.animated
    if (edge.style) denormalized.style = edge.style
    if (edge.className) denormalized.className = edge.className
    if (edge.label) denormalized.label = edge.label
    if (edge.labelStyle) denormalized.labelStyle = edge.labelStyle
    if (edge.labelShowBg !== undefined) denormalized.labelShowBg = edge.labelShowBg
    if (edge.labelBgStyle) denormalized.labelBgStyle = edge.labelBgStyle
    
    return denormalized
  })
}

/**
 * Convert full Supabase URL to storage path
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  
  // If already a path (no protocol), return as-is
  if (!url.startsWith("http")) return url
  
  try {
    const urlObj = new URL(url)
    // Extract path after /public-bucket/
    const match = urlObj.pathname.match(/\/public-bucket\/(.+)/)
    return match ? match[1] : url
  } catch {
    return url
  }
}

/**
 * Convert storage path to full Supabase URL
 */
function denormalizeUrl(path: string | null): string | null {
  if (!path) return null
  
  // If already a full URL, return as-is
  if (path.startsWith("http")) return path
  
  // Build public URL using client (works in browser and server)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return path
  
  return `${supabaseUrl}/storage/v1/object/public/public-bucket/${path}`
}

/**
 * Extract storage path from full URL
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null
  
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/\/public-bucket\/(.+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}
