export interface StudioViewport {
  x: number
  y: number
  zoom: number
}

export interface StudioProject {
  id: string
  user_id: string
  name: string
  thumbnail_url: string | null
  viewport: StudioViewport
  created_at: string
  updated_at: string
}

export interface StudioBoardFields {
  studio_project_id: string
  studio_x: number
  studio_y: number
  studio_width: number
  studio_height: number
}

export type StudioBoardItemSource = "upload" | "asset" | "history" | "paste"

export interface StudioBoardItem {
  id: string
  studio_project_id: string
  user_id: string
  kind: "image" | "video"
  url: string
  source: StudioBoardItemSource
  source_id: string | null
  prompt: string | null
  x: number
  y: number
  width: number
  height: number
  created_at: string
  updated_at: string
}

export interface CreateStudioBoardItemInput {
  kind: "image" | "video"
  url: string
  source?: StudioBoardItemSource
  source_id?: string | null
  prompt?: string | null
  x: number
  y: number
  width: number
  height: number
}

export interface UpdateStudioBoardItemInput {
  x?: number
  y?: number
  width?: number
  height?: number
  prompt?: string | null
}

export interface StudioTile {
  id: string
  clientKey: string
  generationId: string | null
  url: string | null
  kind: "image" | "video"
  status: "pending" | "completed" | "failed"
  prompt: string | null
  model: string | null
  aspectRatio: string | null
  referenceImageUrls: string[]
  x: number
  y: number
  width: number
  height: number
  createdAt: string
  source?: "generation" | "import"
}

export interface CreateStudioProjectInput {
  name?: string
  viewport?: StudioViewport
}

export interface UpdateStudioProjectInput {
  name?: string
  thumbnail_url?: string | null
  viewport?: StudioViewport
}

export const DEFAULT_STUDIO_VIEWPORT: StudioViewport = {
  x: 0,
  y: 0,
  zoom: 1,
}

export const DEFAULT_STUDIO_TILE_HEIGHT = 280
export const DEFAULT_STUDIO_TILE_GAP = 24
export const STUDIO_MIN_ZOOM = 0.2
export const STUDIO_MAX_ZOOM = 3
