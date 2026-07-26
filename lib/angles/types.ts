export type AngleState = {
  rotation: number
  tilt: number
  zoom: number
}

export type CameraPromptSpec = AngleState & {
  framing: string
  horizontalView: string
  verticalView: string
  viewDescription: string
}

export const DEFAULT_ANGLE_STATE: AngleState = {
  rotation: 0,
  tilt: 0,
  zoom: 5,
}
