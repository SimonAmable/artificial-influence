import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./constants"
import { defaultDurationForType, newId } from "./project-helpers"
import type { EditorItem, EditorProject } from "./types"

const base = (project: EditorProject) => ({
  id: newId(),
  from: 0,
  x: 0,
  y: 0,
  width: project.settings.width,
  height: project.settings.height,
  rotation: 0,
  opacity: 1,
  borderRadius: 0,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  crop: null,
  keepAspectRatio: true,
})

export function createTextItem(project: EditorProject, text = "Text"): EditorItem {
  const fps = project.settings.fps
  const { width: cw, height: ch } = project.settings
  /** Tight-ish bounds for one line; canvas selection matches layer rect (Remotion centers text inside). */
  const tw = Math.min(720, Math.round(cw * 0.55))
  const th = 120
  return {
    ...base(project),
    type: "text",
    durationInFrames: defaultDurationForType("text", fps),
    text,
    fontFamily: "Inter",
    fontWeight: "400",
    fontStyle: "normal" as const,
    fontSize: 72,
    textAlign: "center" as const,
    textDirection: "ltr" as const,
    lineHeight: 1.2,
    letterSpacingPx: 0,
    color: "#ffffff",
    backgroundColor: null,
    backgroundPaddingX: 8,
    backgroundRadius: 4,
    width: tw,
    height: th,
    x: (cw - tw) / 2,
    y: (ch - th) / 2,
  }
}

export function createSolidItem(project: EditorProject, fill = "#6366f1"): EditorItem {
  const fps = project.settings.fps
  return {
    ...base(project),
    type: "solid",
    durationInFrames: defaultDurationForType("solid", fps),
    fill,
    width: project.settings.width,
    height: project.settings.height,
    x: 0,
    y: 0,
  }
}

export function createImageItem(
  project: EditorProject,
  src: string,
  opts?: { fileName?: string; durationInFrames?: number }
): EditorItem {
  const fps = project.settings.fps
  return {
    ...base(project),
    type: "image",
    src,
    fileName: opts?.fileName,
    durationInFrames: opts?.durationInFrames ?? defaultDurationForType("image", fps),
    width: Math.min(DEFAULT_WIDTH, project.settings.width * 0.9),
    height: Math.min(DEFAULT_HEIGHT, project.settings.height * 0.9),
    x: project.settings.width * 0.05,
    y: project.settings.height * 0.05,
  }
}

export function createGifItem(
  project: EditorProject,
  src: string,
  opts?: { fileName?: string; durationInFrames?: number }
): EditorItem {
  const fps = project.settings.fps
  return {
    ...base(project),
    type: "gif",
    src,
    fileName: opts?.fileName,
    durationInFrames: opts?.durationInFrames ?? defaultDurationForType("gif", fps),
    width: Math.min(DEFAULT_WIDTH, project.settings.width * 0.9),
    height: Math.min(DEFAULT_HEIGHT, project.settings.height * 0.9),
    x: project.settings.width * 0.05,
    y: project.settings.height * 0.05,
  }
}

export function createVideoItem(
  project: EditorProject,
  src: string,
  sourceDurationFrames: number,
  opts?: { fileName?: string }
): EditorItem {
  const fps = project.settings.fps
  const dur = Math.min(sourceDurationFrames, fps * 60)
  return {
    ...base(project),
    type: "video",
    src,
    fileName: opts?.fileName,
    durationInFrames: dur,
    trimStartFrames: 0,
    trimEndFrames: 0,
    sourceDurationFrames,
    volume: 1,
    volumeDb: 0,
    playbackRate: 1,
    width: project.settings.width,
    height: project.settings.height,
    x: 0,
    y: 0,
  }
}

export function createAudioItem(
  project: EditorProject,
  src: string,
  sourceDurationFrames: number,
  opts?: { fileName?: string }
): EditorItem {
  const fps = project.settings.fps
  const dur = Math.min(sourceDurationFrames, fps * 120)
  return {
    ...base(project),
    type: "audio",
    src,
    fileName: opts?.fileName,
    durationInFrames: dur,
    trimStartFrames: 0,
    trimEndFrames: 0,
    sourceDurationFrames,
    volume: 1,
    volumeDb: 0,
    playbackRate: 1,
    width: 100,
    height: 40,
    x: 0,
    y: project.settings.height - 40,
  }
}

export function createCaptionsItem(project: EditorProject): EditorItem {
  const fps = project.settings.fps
  return {
    ...base(project),
    type: "captions",
    durationInFrames: defaultDurationForType("captions", fps),
    captions: [],
    pageDurationMs: 2000,
    maxLines: 2,
    highlightColor: "#f472b6",
    fontFamily: "Inter",
    fontSize: 48,
    textAlign: "center" as const,
    width: project.settings.width * 0.9,
    height: 200,
    x: project.settings.width * 0.05,
    y: project.settings.height * 0.75,
  }
}
