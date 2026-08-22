export type MotionCopySwapMode = "off" | "character_swap" | "face_swap"

export type MotionCopyActiveSwapMode = Exclude<MotionCopySwapMode, "off">

export function parseMotionCopySwapMode(value: unknown): MotionCopySwapMode {
  if (value === "character_swap") return "character_swap"
  if (value === "face_swap") return "face_swap"
  return "off"
}

export function motionCopySwapModeLabel(mode: MotionCopySwapMode): string {
  switch (mode) {
    case "off":
      return "Default"
    case "character_swap":
      return "Character swap"
    case "face_swap":
      return "Face swap"
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function isMotionCopySwapActive(mode: MotionCopySwapMode): mode is MotionCopyActiveSwapMode {
  return mode === "character_swap" || mode === "face_swap"
}

export function motionCopySwapHistoryToolTag(mode: MotionCopyActiveSwapMode): "character_swap" | "face_swap" {
  return mode === "face_swap" ? "face_swap" : "character_swap"
}
