import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { formatUploadMediaId } from "@/lib/chat/media-id"
import { resolveMediaRef } from "@/lib/chat/resolve-media-ref"
import { createTextItem, createVideoItem } from "@/lib/video-editor/item-factory"
import { createEmptyProject, findItemInProject, syncCompositionToItems } from "@/lib/video-editor/project-helpers"
import {
  assertCanStartRemotionRender,
  startRemotionRenderInBackground,
} from "@/lib/video-editor/remotion-vercel-render"
import { EDITOR_RENDER_RUNNER } from "@/lib/video-editor/render-jobs"
import { findTextStylePreset, TEXT_STYLE_PRESETS } from "@/lib/video-editor/text-style-presets"
import { getVideoDimensions, getVideoDurationSeconds } from "@/lib/video-editor/media-parser"
import {
  editorProjectSchema,
  type EditorProject,
  type TextBackgroundMode,
  type TextItem,
  type TextTransformMode,
  type VideoItem,
} from "@/lib/video-editor/types"

const TEXT_OVERLAY_PRESET_IDS = TEXT_STYLE_PRESETS.map((preset) => preset.id) as [
  string,
  ...string[],
]

const DEFAULT_TEXT_OVERLAY_PRESET_ID =
  TEXT_OVERLAY_PRESET_IDS.includes("tiktok-original")
    ? "tiktok-original"
    : TEXT_OVERLAY_PRESET_IDS[0]

const textOverlayPresetSchema = z.enum(TEXT_OVERLAY_PRESET_IDS)
const textOverlayPlacementSchema = z.enum(["top", "center", "bottom"])
const textOverlayModeSchema = z.enum(["create", "update", "replace"])

const SOURCE_WAIT_POLL_MS = 3000
const SOURCE_WAIT_MAX_MS = 90_000

type TextOverlayPlacement = "top" | "center" | "bottom"
type TextOverlayMode = "create" | "update" | "replace"

type ResolvedSourceVideo = {
  durationSeconds: number
  generationId: string | null
  height: number
  label: string | null
  mediaId: string | null
  mimeType: string
  publicUrl: string
  storagePath: string | null
  width: number
}

type ThreadVideoGenerationRow = {
  chat_thread_id: string | null
  created_at: string
  error_message: string | null
  id: string
  model: string | null
  status: "completed" | "failed" | "pending"
  supabase_storage_path: string | null
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function estimateWrappedLineCount(text: string, fontSize: number, width: number) {
  const plainLines = Math.max(1, text.split(/\r?\n/).length)
  const averageCharWidth = Math.max(1, fontSize * 0.56)
  const charsPerLine = Math.max(12, Math.floor(width / averageCharWidth))
  const estimatedLines = Math.max(plainLines, Math.ceil(text.length / charsPerLine))
  return estimatedLines
}

function inferVideoMimeType(storagePath: string) {
  const lower = storagePath.toLowerCase()
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mov")) return "video/quicktime"
  return "video/mp4"
}

function buildGenerationPublicUrl(supabase: SupabaseClient, storagePath: string) {
  return supabase.storage.from("public-bucket").getPublicUrl(storagePath).data.publicUrl
}

function getTextTrackId(project: EditorProject) {
  return project.tracks.find((track) => track.kind === "text")?.id ?? null
}

function getVideoTrackId(project: EditorProject) {
  return project.tracks.find((track) => track.kind === "video")?.id ?? null
}

function buildGenerationLabel(model: string | null) {
  return `Generated video (${model ?? "video"})`
}

function computeOverlayBounds(
  project: EditorProject,
  item: TextItem,
  placement: TextOverlayPlacement,
) {
  const width = Math.min(860, Math.round(project.settings.width * 0.84))
  const safeMargin = Math.max(24, Math.round(project.settings.height * 0.04))
  const centerX = Math.max(0, Math.round((project.settings.width - width) / 2))

  const topY = clamp(
    Math.round(project.settings.height * 0.12 - item.height / 2),
    safeMargin,
    Math.max(safeMargin, project.settings.height - item.height - safeMargin),
  )
  const centerY = clamp(
    Math.round((project.settings.height - item.height) / 2),
    safeMargin,
    Math.max(safeMargin, project.settings.height - item.height - safeMargin),
  )
  const bottomY = clamp(
    Math.round(project.settings.height * 0.72 - item.height / 2),
    safeMargin,
    Math.max(safeMargin, project.settings.height - item.height - safeMargin),
  )

  const y = placement === "top" ? topY : placement === "center" ? centerY : bottomY

  return {
    width,
    x: centerX,
    y,
  }
}

function normalizeTextItem(
  project: EditorProject,
  item: TextItem,
  presetId: string,
  placement: TextOverlayPlacement | null,
  mode: "create" | "update",
  text: string,
) {
  const preset = findTextStylePreset(presetId) ?? findTextStylePreset(DEFAULT_TEXT_OVERLAY_PRESET_ID)
  const nextPreset = preset ?? TEXT_STYLE_PRESETS[0]!
  const fontSize = Number(nextPreset.patch.fontSize ?? item.fontSize)
  const lineHeight = Number(nextPreset.patch.lineHeight ?? item.lineHeight)
  const backgroundPaddingY = Number(nextPreset.patch.backgroundPaddingY ?? item.backgroundPaddingY ?? 0)
  const strokeWidth = Number(nextPreset.patch.textStrokeWidth ?? item.textStrokeWidth ?? 0)
  const wrappedLineCount = estimateWrappedLineCount(
    text,
    fontSize,
    Math.max(1, item.width - Number(nextPreset.patch.backgroundPaddingX ?? item.backgroundPaddingX) * 2)
  )
  const minHeight = Math.ceil(
    fontSize * lineHeight * Math.max(1.35, wrappedLineCount * 1.1) +
      backgroundPaddingY * 2 +
      Math.max(8, Math.ceil(strokeWidth * 0.75))
  )

  const nextItem: TextItem = {
    ...item,
    text,
    stylePresetId: nextPreset.id,
    fontFamily: String(nextPreset.patch.fontFamily ?? item.fontFamily),
    fontWeight: String(nextPreset.patch.fontWeight ?? item.fontWeight),
    fontStyle: (nextPreset.patch.fontStyle ?? item.fontStyle) as "normal" | "italic",
    fontSize,
    textAlign: (nextPreset.patch.textAlign ?? item.textAlign) as "left" | "center" | "right",
    textDirection: item.textDirection,
    lineHeight,
    letterSpacingPx: Number(nextPreset.patch.letterSpacingPx ?? item.letterSpacingPx),
    color: String(nextPreset.patch.color ?? item.color),
    backgroundColor:
      typeof nextPreset.patch.backgroundColor === "undefined"
        ? item.backgroundColor
        : (nextPreset.patch.backgroundColor ?? null),
    backgroundMode: (nextPreset.patch.backgroundMode ?? item.backgroundMode) as TextBackgroundMode,
    backgroundPaddingX: Number(nextPreset.patch.backgroundPaddingX ?? item.backgroundPaddingX),
    backgroundPaddingY,
    backgroundRadius: Number(nextPreset.patch.backgroundRadius ?? item.backgroundRadius),
    textStrokeColor: String(nextPreset.patch.textStrokeColor ?? item.textStrokeColor),
    textStrokeWidth: Number(nextPreset.patch.textStrokeWidth ?? item.textStrokeWidth),
    textShadow: String(nextPreset.patch.textShadow ?? item.textShadow),
    textTransform: (nextPreset.patch.textTransform ?? item.textTransform) as TextTransformMode,
  }

  if (mode === "create") {
    const bounds = computeOverlayBounds(
      project,
      { ...nextItem, height: Math.max(item.height, minHeight) },
      placement ?? "bottom",
    )
    nextItem.width = bounds.width
    nextItem.height = Math.max(item.height, minHeight)
    nextItem.x = bounds.x
    nextItem.y = bounds.y
  } else if (placement) {
    const bounds = computeOverlayBounds(
      project,
      { ...nextItem, width: item.width, height: item.height },
      placement,
    )
    nextItem.x = bounds.x
    nextItem.y = bounds.y
    nextItem.width = item.width
    nextItem.height = item.height
  }

  return nextItem
}

async function waitForGenerationVideo(
  supabase: SupabaseClient,
  userId: string,
  generationId: string,
): Promise<ThreadVideoGenerationRow> {
  const deadline = Date.now() + SOURCE_WAIT_MAX_MS

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("generations")
      .select("id, chat_thread_id, created_at, error_message, model, status, supabase_storage_path")
      .eq("id", generationId)
      .eq("user_id", userId)
      .eq("type", "video")
      .maybeSingle()

    if (error || !data) {
      throw new Error("Could not load the source video generation.")
    }

    const row = data as ThreadVideoGenerationRow

    if (row.status === "completed" && row.supabase_storage_path) {
      return row
    }

    if (row.status === "failed") {
      throw new Error(row.error_message || "The source video generation failed.")
    }

    await sleep(SOURCE_WAIT_POLL_MS)
  }

  throw new Error("The source video is still generating. Try again once it finishes.")
}

async function resolveThreadSourceVideo(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<ResolvedSourceVideo> {
  const { data: latestVideoRows, error: latestVideoError } = await supabase
    .from("generations")
    .select("id, chat_thread_id, created_at, error_message, model, status, supabase_storage_path")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .eq("type", "video")
    .order("created_at", { ascending: false })
    .limit(5)

  if (latestVideoError) {
    throw new Error(`Could not load the latest thread video: ${latestVideoError.message}`)
  }

  const candidates = (latestVideoRows ?? []) as ThreadVideoGenerationRow[]
  const latestVideo = candidates.find((row) => row.status !== "failed") ?? null
  if (latestVideo) {
    const completedVideo =
      latestVideo.status === "completed" && latestVideo.supabase_storage_path
        ? latestVideo
        : await waitForGenerationVideo(supabase, userId, latestVideo.id)

    if (!completedVideo.supabase_storage_path) {
      throw new Error("The latest thread video did not produce a stored file.")
    }

    return hydrateSourceVideo({
      generationId: completedVideo.id,
      label: buildGenerationLabel(completedVideo.model),
      mediaId: null,
      mimeType: inferVideoMimeType(completedVideo.supabase_storage_path),
      publicUrl: buildGenerationPublicUrl(supabase, completedVideo.supabase_storage_path),
      storagePath: completedVideo.supabase_storage_path,
    })
  }

  const latestFailedVideo = candidates[0] ?? null
  if (latestFailedVideo?.status === "failed") {
    throw new Error(latestFailedVideo.error_message || "The latest thread video generation failed.")
  }

  const { data: uploadRows, error: uploadError } = await supabase
    .from("uploads")
    .select("id, mime_type, label, storage_path, bucket, created_at")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .like("mime_type", "video/%")
    .order("created_at", { ascending: false })
    .limit(1)

  if (uploadError) {
    throw new Error(`Could not load the latest uploaded thread video: ${uploadError.message}`)
  }

  const upload = (uploadRows?.[0] ?? null) as
    | {
        bucket: string
        id: string
        label: string | null
        mime_type: string
        storage_path: string
      }
    | null

  if (!upload?.storage_path) {
    throw new Error("No completed video was found on this chat thread.")
  }

  return hydrateSourceVideo({
    generationId: null,
    label: upload.label,
    mediaId: formatUploadMediaId(upload.id),
    mimeType: upload.mime_type,
    publicUrl: supabase.storage.from(upload.bucket).getPublicUrl(upload.storage_path).data.publicUrl,
    storagePath: upload.storage_path,
  })
}

async function hydrateSourceVideo(input: {
  generationId: string | null
  label: string | null
  mediaId: string | null
  mimeType: string
  publicUrl: string
  storagePath: string | null
}): Promise<ResolvedSourceVideo> {
  const [durationSeconds, dimensions] = await Promise.all([
    getVideoDurationSeconds(input.publicUrl),
    getVideoDimensions(input.publicUrl),
  ])

  return {
    durationSeconds,
    generationId: input.generationId,
    height: dimensions.height,
    label: input.label,
    mediaId: input.mediaId,
    mimeType: input.mimeType,
    publicUrl: input.publicUrl,
    storagePath: input.storagePath,
    width: dimensions.width,
  }
}

async function resolveSourceVideo(params: {
  sourceMediaId?: string
  supabase: SupabaseClient
  threadId?: string
  userId: string
}): Promise<ResolvedSourceVideo> {
  const { sourceMediaId, supabase, threadId, userId } = params

  if (sourceMediaId) {
    const resolved = await resolveMediaRef(supabase, userId, threadId, sourceMediaId, {
      allowCrossThread: true,
    })

    if (!resolved.mimeType.startsWith("video/")) {
      throw new Error(`Media ${sourceMediaId} is not a video.`)
    }

    return hydrateSourceVideo({
      generationId: resolved.kind === "generation" ? resolved.id.replace(/^gen_/, "") : null,
      label: resolved.label,
      mediaId: resolved.id,
      mimeType: resolved.mimeType,
      publicUrl: resolved.publicUrl,
      storagePath: resolved.storagePath,
    })
  }

  if (!threadId) {
    throw new Error("A persisted chat thread is required so the tool can find the source video.")
  }

  return resolveThreadSourceVideo(supabase, userId, threadId)
}

function createProjectFromSourceVideo(source: ResolvedSourceVideo) {
  const fps = 30
  const durationInFrames = Math.max(1, Math.ceil(source.durationSeconds * fps))
  const baseProject = createEmptyProject()
  const project: EditorProject = {
    ...baseProject,
    name: source.label ? `${source.label} Overlay` : "Chat Overlay Render",
    settings: {
      ...baseProject.settings,
      fps,
      width: source.width,
      height: source.height,
      durationInFrames,
    },
  }

  const videoItem = createVideoItem(project, source.publicUrl, durationInFrames, {
    fileName: source.label ?? "Source video",
  }) as VideoItem
  videoItem.width = source.width
  videoItem.height = source.height
  videoItem.x = 0
  videoItem.y = 0

  const videoTrackId = getVideoTrackId(project)
  if (!videoTrackId) {
    throw new Error("The editor project is missing a video track.")
  }

  return syncCompositionToItems({
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === videoTrackId ? { ...track, items: [videoItem] } : { ...track, items: [] },
    ),
    activeTrackId: getTextTrackId(project),
    selectedItemIds: [],
  })
}

function projectContainsSourceVideo(project: EditorProject, sourceUrl: string) {
  return project.tracks.some((track) =>
    track.kind === "video" &&
    track.items.some((item) => item.type === "video" && item.src === sourceUrl),
  )
}

function applyTextOverlayToProject(params: {
  durationInFrames?: number
  mode: TextOverlayMode
  placement: TextOverlayPlacement
  presetId: string
  project: EditorProject
  targetItemId?: string
  text: string
}): { nextProject: EditorProject; textItem: TextItem } {
  const { durationInFrames, mode, placement, presetId, project, targetItemId, text } = params
  const textTrackId = getTextTrackId(project)
  if (!textTrackId) {
    throw new Error("The editor project is missing a text track.")
  }

  const selectedTextId = targetItemId ?? project.selectedItemIds[0] ?? null
  const selectedItem = selectedTextId ? findItemInProject(project, selectedTextId)?.item ?? null : null
  const existingTextItem = selectedItem?.type === "text" ? selectedItem : null
  const shouldUpdate = mode === "update" && Boolean(existingTextItem)

  const textItem =
    shouldUpdate && existingTextItem
      ? normalizeTextItem(
          project,
          existingTextItem,
          presetId,
          placement,
          "update",
          text,
        )
      : normalizeTextItem(
          project,
          createTextItem(project, text) as TextItem,
          presetId,
          placement,
          "create",
          text,
        )

  if (typeof durationInFrames === "number" && !shouldUpdate) {
    textItem.durationInFrames = durationInFrames
  }

  textItem.durationInFrames = Math.min(textItem.durationInFrames, project.settings.durationInFrames)

  const nextTracks = project.tracks.map((track) => {
    if (track.id !== textTrackId) {
      return track
    }

    if (shouldUpdate && existingTextItem) {
      return {
        ...track,
        items: track.items.map((item) => (item.id === existingTextItem.id ? textItem : item)),
      }
    }

    if (mode === "replace") {
      return {
        ...track,
        items: [textItem],
      }
    }

    return {
      ...track,
      items: [...track.items, textItem],
    }
  })

  return {
    nextProject: syncCompositionToItems({
      ...project,
      tracks: nextTracks,
      activeTrackId: textTrackId,
      selectedItemIds: [textItem.id],
    }),
    textItem,
  }
}

async function loadReusableProject(
  supabase: SupabaseClient,
  userId: string,
  editorProjectId: string | undefined,
  source: ResolvedSourceVideo,
) {
  if (!editorProjectId) {
    return null
  }

  const { data: row, error } = await supabase
    .from("editor_projects")
    .select("id, name, state_json")
    .eq("id", editorProjectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !row?.state_json) {
    return null
  }

  const parsed = editorProjectSchema.safeParse({
    ...(typeof row.state_json === "object" && row.state_json !== null ? row.state_json : {}),
    id: row.id,
    name: row.name,
  })

  if (!parsed.success || !projectContainsSourceVideo(parsed.data, source.publicUrl)) {
    return null
  }

  return {
    project: parsed.data,
    projectId: row.id,
    projectName: row.name,
  }
}

async function saveProject(params: {
  project: EditorProject
  projectId?: string | null
  supabase: SupabaseClient
  userId: string
}) {
  const { project, projectId, supabase, userId } = params
  const parsed = editorProjectSchema.safeParse(project)
  if (!parsed.success) {
    throw new Error("The editor project state was invalid.")
  }

  if (projectId) {
    const { error } = await supabase
      .from("editor_projects")
      .update({
        name: parsed.data.name,
        state_json: parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", userId)

    if (error) {
      throw new Error(`Could not save the editor project: ${error.message}`)
    }

    return {
      project: {
        ...parsed.data,
        id: projectId,
      },
      projectId,
      projectName: parsed.data.name,
    }
  }

  const { data, error } = await supabase
    .from("editor_projects")
    .insert({
      user_id: userId,
      name: parsed.data.name,
      state_json: parsed.data,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(`Could not create the editor project: ${error?.message ?? "Unknown error"}`)
  }

  return {
    project: {
      ...parsed.data,
      id: data.id,
    },
    projectId: data.id,
    projectName: parsed.data.name,
  }
}

async function renderProject(params: {
  project: EditorProject
  projectId: string
  supabase: SupabaseClient
  userId: string
}) {
  const { project, projectId, supabase, userId } = params

  assertCanStartRemotionRender()

  const { data: renderJob, error: insertError } = await supabase
    .from("editor_render_jobs")
    .insert({
      user_id: userId,
      project_id: projectId,
      status: "queued",
      progress: 0,
      project_snapshot: project,
      request_payload: {
        runner: EDITOR_RENDER_RUNNER,
        codec: "h264",
        container: "mp4",
        queued_from: "editor-app",
        engine: "@remotion/vercel",
        bundleStrategy: "local-bundle",
      },
    })
    .select("id")
    .single()

  if (insertError || !renderJob?.id) {
    throw new Error(insertError?.message ?? "Failed to create the render job.")
  }

  try {
    await startRemotionRenderInBackground({
      renderJobId: renderJob.id,
      project,
    })
  } catch {
    // The row is updated with failure details by the renderer.
  }

  const { data: completedRow, error: completedError } = await supabase
    .from("editor_render_jobs")
    .select("id, status, output_url, output_storage_path, error_message")
    .eq("id", renderJob.id)
    .eq("user_id", userId)
    .single()

  if (completedError || !completedRow) {
    throw new Error(completedError?.message ?? "The render job could not be loaded after rendering.")
  }

  const row = completedRow as {
    error_message: string | null
    id: string
    output_storage_path: string | null
    output_url: string | null
    status: "completed" | "failed" | "queued" | "rendering"
  }

  if (row.status !== "completed" || !row.output_url || !row.output_storage_path) {
    throw new Error(row.error_message || "The Remotion render did not complete successfully.")
  }

  return {
    renderJobId: row.id,
    storagePath: row.output_storage_path,
    url: row.output_url,
  }
}

async function registerRenderedUpload(params: {
  durationSeconds: number
  label: string
  storagePath: string
  supabase: SupabaseClient
  threadId?: string
  userId: string
}) {
  const { durationSeconds, label, storagePath, supabase, threadId, userId } = params

  if (!threadId) {
    return null
  }

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      user_id: userId,
      chat_thread_id: threadId,
      source: "chat",
      bucket: "public-bucket",
      mime_type: "video/mp4",
      storage_path: storagePath,
      label,
      duration_seconds: durationSeconds,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    console.error("[textOverlay] Failed to register rendered upload:", error?.message)
    return null
  }

  return formatUploadMediaId(data.id)
}

interface CreateTextOverlayToolOptions {
  editorProjectId?: string
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

export function createTextOverlayTool({
  editorProjectId,
  supabase,
  threadId,
  userId,
}: CreateTextOverlayToolOptions) {
  return tool({
    description:
      "Apply a styled Remotion text overlay to a source video, render the finished MP4, and return that final video in chat. This is for hooks, titles, callouts, and lower-thirds using the existing text presets. The tool can create or reuse an editor project automatically, wait for the latest thread video if needed, and does not require approval.",
    inputSchema: z.object({
      text: z
        .string()
        .trim()
        .min(1)
        .max(600)
        .describe("The exact overlay text to place on the video."),
      presetId: textOverlayPresetSchema
        .optional()
        .describe("Optional text preset id. If omitted, the tool picks a readable default."),
      placement: textOverlayPlacementSchema
        .optional()
        .describe("Optional vertical placement for the overlay."),
      mode: textOverlayModeSchema
        .optional()
        .describe("Use replace to swap any existing overlay on a reused project. Use update to edit an existing selected text layer."),
      durationInFrames: z
        .number()
        .int()
        .positive()
        .max(3600)
        .optional()
        .describe("Optional duration for the overlay layer."),
      targetItemId: z
        .string()
        .min(1)
        .optional()
        .describe("Optional existing text item id to update on a reused editor project."),
      sourceMediaId: z
        .string()
        .min(1)
        .optional()
        .describe("Optional video media id to overlay. If omitted, the tool uses the latest video on the current thread."),
    }),
    strict: true,
    execute: async (input) => {
      const requestedText = input.text.trim()
      const requestedPresetId = input.presetId ?? DEFAULT_TEXT_OVERLAY_PRESET_ID
      const preset = findTextStylePreset(requestedPresetId) ?? TEXT_STYLE_PRESETS[0]!
      const placement = input.placement ?? "bottom"
      const mode = input.mode ?? "replace"

      const sourceVideo = await resolveSourceVideo({
        sourceMediaId: input.sourceMediaId,
        supabase,
        threadId,
        userId,
      })

      const reusableProject = await loadReusableProject(
        supabase,
        userId,
        editorProjectId,
        sourceVideo,
      )

      const baseProject = reusableProject?.project ?? createProjectFromSourceVideo(sourceVideo)
      const { nextProject, textItem } = applyTextOverlayToProject({
        durationInFrames: input.durationInFrames,
        mode,
        placement,
        presetId: preset.id,
        project: baseProject,
        targetItemId: input.targetItemId,
        text: requestedText,
      })

      const savedProject = await saveProject({
        project: nextProject,
        projectId: reusableProject?.projectId ?? null,
        supabase,
        userId,
      })

      const renderResult = await renderProject({
        project: savedProject.project,
        projectId: savedProject.projectId,
        supabase,
        userId,
      })

      const renderedMediaId = await registerRenderedUpload({
        durationSeconds: sourceVideo.durationSeconds,
        label: `Text overlay render (${preset.label})`,
        storagePath: renderResult.storagePath,
        supabase,
        threadId,
        userId,
      })

      return {
        status: "completed" as const,
        message: "Rendered the final video with the text overlay applied.",
        projectId: savedProject.projectId,
        projectName: savedProject.projectName,
        itemId: textItem.id,
        placement,
        presetLabel: preset.label,
        previewItem: textItem,
        renderJobId: renderResult.renderJobId,
        renderedMediaId,
        sourceLabel: sourceVideo.label,
        sourceMediaId: sourceVideo.mediaId,
        video: {
          mimeType: "video/mp4",
          storagePath: renderResult.storagePath,
          url: renderResult.url,
        },
      }
    },
  })
}
