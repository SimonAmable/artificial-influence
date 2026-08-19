export const FACE_LOCK_MODES = ["off", "reference", "custom"] as const

export type FaceLockMode = (typeof FACE_LOCK_MODES)[number]

export const FAL_KLING_V3_STD_MOTION_CONTROL =
  "fal-ai/kling-video/v3/standard/motion-control" as const

export const FAL_KLING_V3_PRO_MOTION_CONTROL =
  "fal-ai/kling-video/v3/pro/motion-control" as const

export type FalKlingMotionControlEndpoint =
  | typeof FAL_KLING_V3_STD_MOTION_CONTROL
  | typeof FAL_KLING_V3_PRO_MOTION_CONTROL

/** Per-second credits when routing motion copy through fal for face lock. */
export const FACE_LOCK_CREDITS_PER_SECOND = {
  std: 8,
  pro: 10,
} as const

export function parseFaceLockMode(value: unknown): FaceLockMode {
  if (value === "reference" || value === "custom") return value
  return "off"
}

export function isFaceLockActive(mode: FaceLockMode): boolean {
  return mode === "reference" || mode === "custom"
}

export function shouldRouteMotionCopyToFal(faceLock: unknown): boolean {
  return isFaceLockActive(parseFaceLockMode(faceLock))
}

export function resolveFalKlingMotionControlEndpoint(
  mode: unknown,
): FalKlingMotionControlEndpoint {
  return normalizeEnumKey(mode) === "std"
    ? FAL_KLING_V3_STD_MOTION_CONTROL
    : FAL_KLING_V3_PRO_MOTION_CONTROL
}

export function resolveFaceLockImageUrl(options: {
  faceLock: FaceLockMode
  referenceImageUrl?: string | null
  customFaceImageUrl?: string | null
}): string | null {
  if (options.faceLock === "reference") {
    const url = pickUrl(options.referenceImageUrl)
    return url
  }
  if (options.faceLock === "custom") {
    return pickUrl(options.customFaceImageUrl)
  }
  return null
}

export function buildFalKlingMotionControlElement(faceImageUrl: string): {
  frontal_image_url: string
  reference_image_urls: string[]
} {
  return {
    frontal_image_url: faceImageUrl,
    reference_image_urls: [faceImageUrl],
  }
}

export function faceLockLabel(mode: FaceLockMode): string {
  switch (mode) {
    case "off":
      return "Off"
    case "reference":
      return "From reference"
    case "custom":
      return "Custom"
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

function pickUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeEnumKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value).trim().toLowerCase()
}
