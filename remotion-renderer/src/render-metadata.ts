import { computeProjectEndFrame } from "./project-helpers"
import type { EditorProject } from "./project-types"

export function deriveTimelineCompositionMetadata(project: EditorProject) {
  return {
    durationInFrames: computeProjectEndFrame(project),
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
  }
}
