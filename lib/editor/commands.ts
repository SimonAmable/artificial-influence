import type {
  AgentCommand,
  EditorProject,
  TimelineItem,
  TimelineState,
  TimelineTrack,
  TransitionConfig,
} from "@/lib/editor/types"
import {
  DEFAULT_PLACEMENT,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSITION,
  clamp,
  makeId,
  recalculateCompositionDuration,
  roundFrame,
} from "@/lib/editor/utils"

export function findTrackById(
  timelineState: TimelineState,
  trackId: string,
): TimelineTrack | undefined {
  return timelineState.tracks.find((track) => track.id === trackId)
}

export function findItemById(
  timelineState: TimelineState,
  itemId: string,
): { item: TimelineItem; track: TimelineTrack } | null {
  for (const track of timelineState.tracks) {
    const item = track.items.find((candidate) => candidate.id === itemId)
    if (item) {
      return { item, track }
    }
  }
  return null
}

function sortTrackItems(track: TimelineTrack) {
  track.items.sort((a, b) => a.startFrame - b.startFrame)
}

function updateProjectDuration(project: EditorProject): EditorProject {
  project.composition_settings.durationInFrames = recalculateCompositionDuration(
    project.timeline_state,
    300,
  )
  return project
}

export function addTimelineItem(
  project: EditorProject,
  item: TimelineItem,
): EditorProject {
  const next = structuredClone(project)
  const track = findTrackById(next.timeline_state, item.trackId)
  if (!track) {
    throw new Error("Target track not found")
  }

  track.items.push(item)
  sortTrackItems(track)
  return updateProjectDuration(next)
}

export function updateTimelineItem(
  project: EditorProject,
  itemId: string,
  patch: Partial<TimelineItem>,
): EditorProject {
  const next = structuredClone(project)
  const found = findItemById(next.timeline_state, itemId)

  if (!found) {
    throw new Error("Timeline item not found")
  }

  Object.assign(found.item, patch)
  found.item.startFrame = roundFrame(found.item.startFrame)
  found.item.durationInFrames = Math.max(1, roundFrame(found.item.durationInFrames))
  found.item.trimStartInFrames = roundFrame(found.item.trimStartInFrames)
  found.item.trimEndInFrames = Math.max(
    found.item.trimStartInFrames + 1,
    roundFrame(found.item.trimEndInFrames),
  )
  found.item.playbackRate = clamp(found.item.playbackRate, 0.25, 4)
  sortTrackItems(found.track)
  return updateProjectDuration(next)
}

export function moveTimelineItem(
  project: EditorProject,
  itemId: string,
  nextStartFrame: number,
  nextTrackId?: string,
): EditorProject {
  const next = structuredClone(project)
  const found = findItemById(next.timeline_state, itemId)

  if (!found) {
    throw new Error("Timeline item not found")
  }

  found.track.items = found.track.items.filter((item) => item.id !== itemId)
  const targetTrack =
    (nextTrackId ? findTrackById(next.timeline_state, nextTrackId) : found.track) ??
    found.track

  found.item.trackId = targetTrack.id
  found.item.startFrame = roundFrame(nextStartFrame)
  targetTrack.items.push(found.item)
  sortTrackItems(targetTrack)
  return updateProjectDuration(next)
}

export function removeTimelineItem(
  project: EditorProject,
  itemId: string,
): EditorProject {
  const next = structuredClone(project)
  for (const track of next.timeline_state.tracks) {
    const nextItems = track.items.filter((item) => item.id !== itemId)
    if (nextItems.length !== track.items.length) {
      track.items = nextItems
      return updateProjectDuration(next)
    }
  }

  throw new Error("Timeline item not found")
}

export function splitTimelineItem(
  project: EditorProject,
  itemId: string,
  splitFrame: number,
): EditorProject {
  const next = structuredClone(project)
  const found = findItemById(next.timeline_state, itemId)

  if (!found) {
    throw new Error("Timeline item not found")
  }

  const localSplit = roundFrame(splitFrame - found.item.startFrame)
  if (localSplit <= 0 || localSplit >= found.item.durationInFrames) {
    throw new Error("Split point must be inside the item")
  }

  const rightItem = structuredClone(found.item)
  rightItem.id = makeId(found.item.type)
  rightItem.startFrame = found.item.startFrame + localSplit
  rightItem.durationInFrames = found.item.durationInFrames - localSplit

  if (found.item.type === "audio" || found.item.type === "video") {
    const sourceOffset = Math.round(localSplit * found.item.playbackRate)
    rightItem.trimStartInFrames = found.item.trimStartInFrames + sourceOffset
    found.item.trimEndInFrames = rightItem.trimStartInFrames
  }

  found.item.durationInFrames = localSplit
  found.track.items.push(rightItem)
  sortTrackItems(found.track)
  return updateProjectDuration(next)
}

export function setTimelineItemSpeed(
  project: EditorProject,
  itemId: string,
  nextPlaybackRate: number,
): EditorProject {
  const next = structuredClone(project)
  const found = findItemById(next.timeline_state, itemId)
  if (!found) {
    throw new Error("Timeline item not found")
  }

  const playbackRate = clamp(nextPlaybackRate, 0.25, 4)
  const sourceRange =
    found.item.trimEndInFrames - found.item.trimStartInFrames

  found.item.playbackRate = playbackRate
  found.item.durationInFrames = Math.max(
    1,
    Math.round(sourceRange / playbackRate),
  )

  return updateProjectDuration(next)
}

export function setTimelineItemVolume(
  project: EditorProject,
  itemId: string,
  volume: number,
  muted?: boolean,
): EditorProject {
  return updateTimelineItem(project, itemId, {
    volume: clamp(volume, 0, 1),
    muted: muted ?? volume <= 0,
  })
}

export function setTimelineItemTransition(
  project: EditorProject,
  itemId: string,
  transition: TransitionConfig,
): EditorProject {
  return updateTimelineItem(project, itemId, { transition })
}

export function addTextOverlay(
  project: EditorProject,
  text: string,
  startFrame: number,
  durationInFrames = 150,
): EditorProject {
  return addTimelineItem(project, {
    id: makeId("text"),
    type: "text",
    label: text.slice(0, 40) || "Text",
    trackId: "overlay-track",
    startFrame: roundFrame(startFrame),
    durationInFrames,
    sourceDurationInFrames: durationInFrames,
    trimStartInFrames: 0,
    trimEndInFrames: durationInFrames,
    playbackRate: 1,
    volume: 1,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    transition: DEFAULT_TRANSITION,
    createdAt: new Date().toISOString(),
    text,
    placement: { ...DEFAULT_PLACEMENT },
    style: { ...DEFAULT_TEXT_STYLE },
  })
}

export function addAssetToProject(
  project: EditorProject,
  input: {
    type: "video" | "image" | "audio"
    src: string
    label: string
    durationInFrames: number
    startFrame: number
    trackId?: string
    mediaType?: string
  },
): EditorProject {
  const base = {
    id: makeId(input.type),
    label: input.label,
    trackId:
      input.trackId ??
      (input.type === "audio"
        ? "audio-track"
        : input.type === "image"
          ? "overlay-track"
          : "video-track"),
    startFrame: roundFrame(input.startFrame),
    durationInFrames: input.durationInFrames,
    sourceDurationInFrames: input.durationInFrames,
    trimStartInFrames: 0,
    trimEndInFrames: input.durationInFrames,
    playbackRate: 1,
    volume: 1,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    transition: DEFAULT_TRANSITION,
    createdAt: new Date().toISOString(),
    src: input.src,
    mediaType: input.mediaType,
  }

  if (input.type === "audio") {
    return addTimelineItem(project, {
      ...base,
      type: "audio",
    })
  }

  if (input.type === "image") {
    return addTimelineItem(project, {
      ...base,
      type: "image",
      placement: { ...DEFAULT_PLACEMENT },
    })
  }

  return addTimelineItem(project, {
    ...base,
    type: "video",
    placement: { ...DEFAULT_PLACEMENT },
  })
}

export function applyAgentCommand(
  project: EditorProject,
  command: AgentCommand,
): EditorProject {
  switch (command.type) {
    case "move-item":
      return moveTimelineItem(
        project,
        String(command.targetItemId),
        Number(command.payload?.startFrame ?? 0),
        typeof command.payload?.trackId === "string"
          ? command.payload.trackId
          : undefined,
      )
    case "split-item":
      return splitTimelineItem(
        project,
        String(command.targetItemId),
        Number(command.payload?.splitFrame ?? 0),
      )
    case "change-speed":
      return setTimelineItemSpeed(
        project,
        String(command.targetItemId),
        Number(command.payload?.playbackRate ?? 1),
      )
    case "change-volume":
      return setTimelineItemVolume(
        project,
        String(command.targetItemId),
        Number(command.payload?.volume ?? 1),
        typeof command.payload?.muted === "boolean"
          ? command.payload.muted
          : undefined,
      )
    case "remove-item":
      return removeTimelineItem(project, String(command.targetItemId))
    case "apply-transition":
      return setTimelineItemTransition(project, String(command.targetItemId), {
        type:
          (command.payload?.type as TransitionConfig["type"] | undefined) ??
          "crossfade",
        durationInFrames: Number(command.payload?.durationInFrames ?? 12),
      })
    case "add-text":
      return addTextOverlay(
        project,
        String(command.payload?.text ?? "New text"),
        Number(command.payload?.startFrame ?? 0),
        Number(command.payload?.durationInFrames ?? 150),
      )
    case "add-asset":
      return addAssetToProject(project, {
        type: command.payload?.type as "video" | "image" | "audio",
        src: String(command.payload?.src ?? ""),
        label: String(command.payload?.label ?? "Imported media"),
        durationInFrames: Number(command.payload?.durationInFrames ?? 150),
        startFrame: Number(command.payload?.startFrame ?? 0),
        trackId:
          typeof command.payload?.trackId === "string"
            ? command.payload.trackId
            : undefined,
        mediaType:
          typeof command.payload?.mediaType === "string"
            ? command.payload.mediaType
            : undefined,
      })
    case "trim-item":
      return updateTimelineItem(project, String(command.targetItemId), {
        trimStartInFrames: Number(command.payload?.trimStartInFrames ?? 0),
        trimEndInFrames: Number(command.payload?.trimEndInFrames ?? 0),
        durationInFrames: Number(command.payload?.durationInFrames ?? 1),
      })
    default:
      return project
  }
}
