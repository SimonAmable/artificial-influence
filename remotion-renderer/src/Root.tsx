import { Composition } from "remotion"
import { COMPOSITION_ID } from "./constants"
import { editorProjectSchema, type EditorProject } from "./project-types"
import { deriveTimelineCompositionMetadata } from "./render-metadata"
import { TimelineComposition } from "./TimelineComposition"

const defaultProject: EditorProject = editorProjectSchema.parse({
  id: null,
  name: "Untitled Project",
  settings: {
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 150,
  },
  tracks: [],
  activeTrackId: null,
  selectedItemIds: [],
  snappingEnabled: true,
  canvasZoom: 1,
  timelineZoomPxPerFrame: 2,
})

export function Root() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={TimelineComposition}
      width={defaultProject.settings.width}
      height={defaultProject.settings.height}
      fps={defaultProject.settings.fps}
      durationInFrames={defaultProject.settings.durationInFrames}
      defaultProps={{ project: defaultProject }}
      calculateMetadata={({ props }) =>
        deriveTimelineCompositionMetadata(props.project)
      }
    />
  )
}
