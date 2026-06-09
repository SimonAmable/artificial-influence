import assert from "node:assert/strict"

const { buildFfmpegAssProject, validateFfmpegTextOverlayProject } = await import(
  "../lib/video-editor/ffmpeg-ass.ts"
)

const base = {
  borderRadius: 0,
  crop: null,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  from: 0,
  height: 1920,
  keepAspectRatio: true,
  opacity: 1,
  rotation: 0,
  width: 1080,
  x: 0,
  y: 0,
}
const video = {
  ...base,
  id: "video",
  type: "video",
  src: "https://example.com/source.mp4",
  durationInFrames: 300,
  trimStartFrames: 0,
  trimEndFrames: 0,
  sourceDurationFrames: 300,
  volume: 1,
  volumeDb: 0,
  playbackRate: 1,
}
const text = {
  ...base,
  id: "text",
  type: "text",
  from: 30,
  durationInFrames: 240,
  x: 110,
  y: 750,
  width: 860,
  height: 300,
  text: "this is a long {editable} text overlay that should wrap onto another line",
  stylePresetId: "tiktok-original",
  fontFamily: "Inter",
  fontWeight: "800",
  fontStyle: "normal",
  fontSize: 72,
  textAlign: "center",
  textDirection: "ltr",
  lineHeight: 1,
  letterSpacingPx: 0,
  color: "#ffffff",
  backgroundColor: null,
  backgroundMode: "none",
  backgroundPaddingX: 0,
  backgroundPaddingY: 0,
  backgroundRadius: 0,
  textStrokeColor: "#000000",
  textStrokeWidth: 6,
  textShadow: "0 2px 4px #000",
  textTransform: "uppercase",
}
const project = {
  id: "project",
  name: "ASS smoke test",
  settings: { fps: 30, width: 1080, height: 1920, durationInFrames: 300 },
  tracks: [
    { id: "video-track", kind: "video", label: "Video", muted: false, hidden: false, items: [video] },
    { id: "text-track", kind: "text", label: "Text", muted: false, hidden: false, items: [text] },
  ],
  activeTrackId: "text-track",
  selectedItemIds: ["text"],
  snappingEnabled: true,
  canvasZoom: 1,
  timelineZoomPxPerFrame: 2,
}

const result = buildFfmpegAssProject(project)
assert.match(result.ass, /\[Events\]/)
assert.match(
  result.ass,
  /Style: Overlay0,Noto Sans,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,3,5,0,0,0,1/
)
assert.match(result.ass, /\\pos\(540,900\)/)
assert.match(result.ass, /\\N/)
assert.match(result.ass, /\\\{EDITABLE\\\}/)
assert.match(result.ass, /THIS IS A LONG/)

const invalidProject = structuredClone(project)
invalidProject.tracks.push({
  id: "image-track",
  kind: "image",
  label: "Image",
  muted: false,
  hidden: false,
  items: [
    {
      ...base,
      id: "image",
      type: "image",
      src: "https://example.com/image.png",
      durationInFrames: 300,
    },
  ],
})
assert.throws(
  () => validateFfmpegTextOverlayProject(invalidProject),
  /do not support visible image/
)

const snapchatText = {
  ...text,
  id: "snapchat-text",
  x: 0,
  y: 1400,
  width: 1080,
  height: 72,
  text: "Wait, this cost how much? 🤯",
  stylePresetId: "snapchat-classic",
  fontFamily:
    '"Helvetica Neue", Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  fontWeight: "700",
  fontSize: 46,
  lineHeight: 1.15,
  backgroundColor: "rgba(0,0,0,0.75)",
  backgroundMode: "box",
  backgroundPaddingX: 18,
  backgroundPaddingY: 10,
  backgroundRadius: 8,
  textStrokeWidth: 0,
  textTransform: "none",
}
const snapchatProject = {
  ...project,
  tracks: [
    project.tracks[0],
    { ...project.tracks[1], items: [snapchatText] },
  ],
}
const snapchatResult = buildFfmpegAssProject(snapchatProject)
assert.match(snapchatResult.ass, /Style: Overlay0,Noto Sans,46,/)
assert.doesNotMatch(snapchatResult.ass, /Style: Overlay0,Noto Serif,/)
assert.match(snapchatResult.ass, /\\fnNoto Color Emoji/)
assert.match(snapchatResult.ass, /\\p1/)
assert.match(snapchatResult.ass, /Dialogue: 1,/)

console.log("FFmpeg ASS checks passed.")
