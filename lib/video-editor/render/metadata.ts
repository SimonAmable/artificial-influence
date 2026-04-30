import { computeProjectEndFrame } from "../project-helpers"
import type { EditorProject } from "../types"

export type TimelineCompositionProps = {
  project: EditorProject
}

export type TimelineCompositionMetadata = {
  durationInFrames: number
  width: number
  height: number
  fps: number
}

export function deriveTimelineCompositionMetadata(
  project: EditorProject
): TimelineCompositionMetadata {
  return {
    durationInFrames: computeProjectEndFrame(project),
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
  }
}
