import type { AnglesModelId } from "./constants.ts"
import { normalizeAngleState } from "./camera-math.ts"
import type { AngleState, CameraPromptSpec } from "./types.ts"

const PRESERVE_CONSTRAINTS = [
  "subject identity and facial features",
  "body and object proportions",
  "clothing and accessories",
  "scene contents and spatial relationships",
  "materials, colors, and lighting character",
]

function describeHorizontalView(rotation: number): string {
  const sector = Math.round(rotation / 45) % 8
  return [
    "front view",
    "front-right three-quarter view",
    "right profile",
    "rear-right three-quarter view",
    "rear view",
    "rear-left three-quarter view",
    "left profile",
    "front-left three-quarter view",
  ][sector]!
}

function describeVerticalView(tilt: number): string {
  if (tilt >= 11) return "high-angle view"
  if (tilt <= -11) return "low-angle view"
  return "eye-level view"
}

function describeFraming(zoom: number): string {
  if (zoom >= 8) return "close framing"
  if (zoom <= 3) return "wide framing"
  return "medium framing"
}

export function buildCameraPromptSpec(state: AngleState): CameraPromptSpec {
  const normalized = normalizeAngleState(state)
  const horizontalView = describeHorizontalView(normalized.rotation)
  const verticalView = describeVerticalView(normalized.tilt)
  const framing = describeFraming(normalized.zoom)

  return {
    ...normalized,
    horizontalView,
    verticalView,
    framing,
    viewDescription: `${horizontalView}, ${verticalView}, ${framing}`,
  }
}

export function buildAnglesPrompt(model: AnglesModelId, state: AngleState): string {
  const camera = buildCameraPromptSpec(state)

  if (model === "google/nano-banana-2-lite") {
    return JSON.stringify({
      task: "recreate_reference_from_new_camera_angle",
      reference: "Image 1",
      camera: {
        rotation_degrees: camera.rotation,
        tilt_degrees: camera.tilt,
        zoom_level: camera.zoom,
        view: camera.viewDescription,
      },
      preserve: PRESERVE_CONSTRAINTS,
      instruction:
        "Render one coherent image as if the camera physically moved to this position. Reveal only scene details that are spatially plausible. Do not create a collage, duplicate the subject, or rotate the image as a flat plane.",
    })
  }

  return [
    "Using Image 1 as the reference, recreate the same subject and scene from a physically new camera position.",
    `Set the camera to ${camera.rotation} degrees rotation and ${camera.tilt} degrees tilt, with zoom level ${camera.zoom} out of 10.`,
    `The result should read as a ${camera.viewDescription}.`,
    `Preserve ${PRESERVE_CONSTRAINTS.join(", ")}.`,
    "Reveal only spatially plausible details. Generate one coherent image, not a collage, and do not rotate the reference as a flat plane.",
  ].join(" ")
}
