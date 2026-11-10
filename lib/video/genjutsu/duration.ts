import { GENJUTSU_MAX_SOURCE_SECONDS, GENJUTSU_MIN_SECONDS } from "./constants"

export function resolveGenjutsuDuration(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Could not read the video length.")
  }
  if (seconds > GENJUTSU_MAX_SOURCE_SECONDS) {
    throw new Error("Use a clip that is 15 seconds or shorter.")
  }
  return Math.min(
    GENJUTSU_MAX_SOURCE_SECONDS,
    Math.max(GENJUTSU_MIN_SECONDS, Math.round(seconds)),
  )
}
