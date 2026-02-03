import type { Node, Edge } from "@xyflow/react"

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

// ===== Client-side Helper Functions =====

/**
 * Client-side wrapper for fetching user canvases
 */
export async function fetchUserCanvases(): Promise<Canvas[]> {
  const response = await fetch("/api/canvases")
  if (!response.ok) {
    throw new Error("Failed to fetch canvases")
  }
  return response.json()
}

/**
 * Client-side wrapper for fetching a specific canvas
 */
export async function fetchCanvas(canvasId: string): Promise<Canvas> {
  const response = await fetch(`/api/canvases/${canvasId}`)
  if (!response.ok) {
    throw new Error("Failed to fetch canvas")
  }
  return response.json()
}

/**
 * Client-side wrapper for saving a canvas
 */
export async function saveCanvasClient(
  canvasId: string,
  updates: UpdateCanvasInput
): Promise<Canvas> {
  const response = await fetch(`/api/canvases/${canvasId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  
  if (!response.ok) {
    throw new Error("Failed to save canvas")
  }
  
  return response.json()
}

/**
 * Client-side wrapper for creating a new canvas
 */
export async function createCanvasClient(
  input: CreateCanvasInput
): Promise<Canvas> {
  const response = await fetch("/api/canvases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    throw new Error("Failed to create canvas")
  }
  
  return response.json()
}

/**
 * Client-side wrapper for deleting a canvas
 */
export async function deleteCanvasClient(canvasId: string): Promise<void> {
  const response = await fetch(`/api/canvases/${canvasId}`, {
    method: "DELETE",
  })
  
  if (!response.ok) {
    throw new Error("Failed to delete canvas")
  }
}
