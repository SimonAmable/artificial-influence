import type { Edge, Node } from "@xyflow/react"

export type MiniAppStatus = "draft" | "published"
export type MiniAppNodeRole = "input" | "output"

export interface MiniAppNodeConfig {
  node_id: string
  show_in_mini_app: boolean
  user_can_edit: boolean
  required: boolean
  role: MiniAppNodeRole
}

export type MiniAppNodeConfigMap = Record<string, MiniAppNodeConfig>

export interface MiniApp {
  id: string
  user_id: string
  workflow_id: string
  workflow_version: string
  name: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  status: MiniAppStatus
  featured_output_node_id: string | null
  node_config: MiniAppNodeConfigMap
  snapshot_nodes: Node[]
  snapshot_edges: Edge[]
  created_at: string
  updated_at: string
}

export interface CreateMiniAppInput {
  workflow_id: string
  workflow_version: string
  name: string
  slug: string
  description?: string | null
  thumbnail_url?: string | null
  status?: MiniAppStatus
  featured_output_node_id?: string | null
  node_config: MiniAppNodeConfigMap
  snapshot_nodes: Node[]
  snapshot_edges: Edge[]
}

export interface UpdateMiniAppInput {
  workflow_version?: string
  name?: string
  slug?: string
  description?: string | null
  thumbnail_url?: string | null
  status?: MiniAppStatus
  featured_output_node_id?: string | null
  node_config?: MiniAppNodeConfigMap
  snapshot_nodes?: Node[]
  snapshot_edges?: Edge[]
}

export interface MiniAppDraft {
  name: string
  slug: string
  description: string
  thumbnail_url: string | null
  featured_output_node_id: string | null
  node_config: MiniAppNodeConfigMap
}
