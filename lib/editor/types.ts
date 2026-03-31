export type EditorAspectRatioPreset = "landscape" | "portrait" | "square"

export type TrackType = "video" | "audio" | "overlay"

export type TimelineItemType = "video" | "image" | "audio" | "text"

export type TransitionType = "cut" | "crossfade" | "fade-black"

export interface TransitionConfig {
  type: TransitionType
  durationInFrames: number
}

export interface CompositionSettings {
  width: number
  height: number
  fps: number
  durationInFrames: number
  backgroundColor: string
  aspectRatioPreset: EditorAspectRatioPreset
}

export interface TimelineItemPlacement {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  objectFit: "cover" | "contain" | "fill"
}

export interface TextStyleConfig {
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  color: string
  textAlign: "left" | "center" | "right"
  backgroundColor: string
}

export interface TimelineItemBase {
  id: string
  type: TimelineItemType
  label: string
  trackId: string
  startFrame: number
  durationInFrames: number
  sourceDurationInFrames: number
  trimStartInFrames: number
  trimEndInFrames: number
  playbackRate: number
  volume: number
  muted: boolean
  fadeInFrames: number
  fadeOutFrames: number
  transition: TransitionConfig
  createdAt: string
}

export interface VideoTimelineItem extends TimelineItemBase {
  type: "video"
  src: string
  mediaType?: string
  placement: TimelineItemPlacement
}

export interface ImageTimelineItem extends TimelineItemBase {
  type: "image"
  src: string
  mediaType?: string
  placement: TimelineItemPlacement
}

export interface AudioTimelineItem extends TimelineItemBase {
  type: "audio"
  src: string
  mediaType?: string
}

export interface TextTimelineItem extends TimelineItemBase {
  type: "text"
  text: string
  placement: TimelineItemPlacement
  style: TextStyleConfig
}

export type TimelineItem =
  | VideoTimelineItem
  | ImageTimelineItem
  | AudioTimelineItem
  | TextTimelineItem

export interface TimelineTrack {
  id: string
  name: string
  type: TrackType
  items: TimelineItem[]
}

export interface TimelineState {
  tracks: TimelineTrack[]
}

export type EditorRenderStatus =
  | "idle"
  | "queued"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled"

export interface EditorProject {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  composition_settings: CompositionSettings
  timeline_state: TimelineState
  last_opened_at: string | null
  created_at: string
  updated_at: string
  last_render_status: EditorRenderStatus
  last_rendered_at: string | null
}

export interface EditorProjectSummary {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  composition_settings: CompositionSettings
  duration_in_frames: number
  last_opened_at: string | null
  created_at: string
  updated_at: string
  last_render_status: EditorRenderStatus
  last_rendered_at: string | null
}

export interface CreateEditorProjectInput {
  name?: string
  description?: string | null
  composition_settings?: CompositionSettings
  timeline_state?: TimelineState
  thumbnail_url?: string | null
}

export interface UpdateEditorProjectInput {
  name?: string
  description?: string | null
  thumbnail_url?: string | null
  composition_settings?: CompositionSettings
  timeline_state?: TimelineState
  last_render_status?: EditorRenderStatus
  last_rendered_at?: string | null
}

export interface EditorRenderJob {
  id: string
  project_id: string
  user_id: string
  status: EditorRenderStatus
  provider: string
  provider_job_id: string | null
  output_url: string | null
  output_asset_id: string | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type AgentCommandType =
  | "inspect-project"
  | "list-items"
  | "add-asset"
  | "add-text"
  | "move-item"
  | "split-item"
  | "trim-item"
  | "change-speed"
  | "change-volume"
  | "remove-item"
  | "apply-transition"
  | "start-export"

export interface AgentCommand {
  type: AgentCommandType
  targetItemId?: string
  targetTrackId?: string
  payload?: Record<string, unknown>
}

export interface PendingAgentAction {
  id: string
  label: string
  command: AgentCommand
  requiresConfirmation: boolean
  createdAt: string
}

export interface AgentExecutionStep {
  id: string
  index: number
  label: string
  summary: string
  status: "executed" | "pending_confirmation" | "skipped"
  command?: AgentCommand
}

export interface AgentCommandLogEntry {
  id: string
  createdAt: string
  summary: string
  command: AgentCommand
  steps?: AgentExecutionStep[]
}

export interface EditorAgentSession {
  id: string
  project_id: string
  user_id: string
  messages: unknown[]
  pending_action: PendingAgentAction | null
  command_history: AgentCommandLogEntry[]
  created_at: string
  updated_at: string
}

export interface EditorRuntimeContext {
  projectId: string | null
  selectionItemIds: string[]
  playheadFrame: number
  activeRoute: "editor" | "agent-chat" | "other"
}
