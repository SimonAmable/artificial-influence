import type { EditorItem, EditorProject, TextItem, VideoItem } from "./types"

export type FfmpegTextOverlayProject = {
  ass: string
  sourceVideo: VideoItem
  textItems: TextItem[]
}

const FONT_FALLBACKS = {
  handwriting: "Noto Serif",
  mono: "Noto Sans Mono",
  sans: "Noto Sans",
  serif: "Noto Serif",
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isNearly(value: number, target: number) {
  return Math.abs(value - target) < 0.001
}

function isVisibleItem(item: EditorItem) {
  return item.opacity > 0 && item.durationInFrames > 0
}

function assertSupportedSourceVideo(project: EditorProject, item: VideoItem) {
  const isFullFrame =
    isNearly(item.x, 0) &&
    isNearly(item.y, 0) &&
    isNearly(item.width, project.settings.width) &&
    isNearly(item.height, project.settings.height)

  if (
    !isFullFrame ||
    !isNearly(item.rotation, 0) ||
    !isNearly(item.opacity, 1) ||
    !isNearly(item.playbackRate, 1) ||
    item.crop !== null ||
    item.trimStartFrames !== 0 ||
    item.trimEndFrames !== 0
  ) {
    throw new Error(
      "FFmpeg chat overlays require one untrimmed, full-frame source video. Open this project in the editor for advanced transforms."
    )
  }
}

export function validateFfmpegTextOverlayProject(
  project: EditorProject
): { sourceVideo: VideoItem; textItems: TextItem[] } {
  const visibleItems = project.tracks.flatMap((track) =>
    track.hidden ? [] : track.items.filter(isVisibleItem)
  )
  const videos = visibleItems.filter((item): item is VideoItem => item.type === "video")
  const textItems = visibleItems.filter((item): item is TextItem => item.type === "text")
  const unsupported = visibleItems.filter(
    (item) => item.type !== "video" && item.type !== "text"
  )

  if (videos.length !== 1) {
    throw new Error("FFmpeg chat overlays require exactly one visible source video.")
  }
  if (textItems.length === 0) {
    throw new Error("FFmpeg chat overlays require at least one visible text layer.")
  }
  if (unsupported.length > 0) {
    throw new Error(
      `FFmpeg chat overlays do not support visible ${unsupported[0]!.type} layers. Open this project in the editor for advanced rendering.`
    )
  }

  assertSupportedSourceVideo(project, videos[0])
  return { sourceVideo: videos[0], textItems }
}

function resolveFontFamily(fontFamily: string) {
  const lower = fontFamily.toLowerCase()
  if (lower.includes("source code") || lower.includes("mono") || lower.includes("consolas")) {
    return FONT_FALLBACKS.mono
  }
  if (lower.includes("georgia") || lower.includes("times") || lower.includes("serif")) {
    return FONT_FALLBACKS.serif
  }
  if (
    lower.includes("yesteryear") ||
    lower.includes("script") ||
    lower.includes("handwriting") ||
    lower.includes("comic")
  ) {
    return FONT_FALLBACKS.handwriting
  }
  return FONT_FALLBACKS.sans
}

function parseCssColor(value: string | null | undefined) {
  const input = (value ?? "#000000").trim().toLowerCase()
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hex) {
    const raw = hex[1]!
    const expanded =
      raw.length === 3
        ? raw
            .split("")
            .map((part) => `${part}${part}`)
            .join("")
        : raw
    return {
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      red: Number.parseInt(expanded.slice(0, 2), 16),
    }
  }

  const rgba = input.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/
  )
  if (rgba) {
    return {
      alpha: clamp(Number(rgba[4] ?? 1), 0, 1),
      blue: clamp(Math.round(Number(rgba[3])), 0, 255),
      green: clamp(Math.round(Number(rgba[2])), 0, 255),
      red: clamp(Math.round(Number(rgba[1])), 0, 255),
    }
  }

  return { alpha: 1, blue: 0, green: 0, red: 0 }
}

function assColor(value: string | null | undefined, opacity = 1) {
  const parsed = parseCssColor(value)
  const alpha = 255 - Math.round(255 * clamp(parsed.alpha * opacity, 0, 1))
  return `&H${alpha.toString(16).padStart(2, "0")}${parsed.blue
    .toString(16)
    .padStart(2, "0")}${parsed.green.toString(16).padStart(2, "0")}${parsed.red
    .toString(16)
    .padStart(2, "0")}`.toUpperCase()
}

function frameToAssTime(frame: number, fps: number) {
  const totalCentiseconds = Math.max(0, Math.round((frame / fps) * 100))
  const hours = Math.floor(totalCentiseconds / 360000)
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000)
  const seconds = Math.floor((totalCentiseconds % 6000) / 100)
  const centiseconds = totalCentiseconds % 100
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`
}

function wrapText(item: TextItem) {
  const text = item.textTransform === "uppercase" ? item.text.toUpperCase() : item.text
  const usableWidth = Math.max(1, item.width - item.backgroundPaddingX * 2)
  const averageCharacterWidth = Math.max(1, item.fontSize * 0.56 + item.letterSpacingPx)
  const maxCharacters = Math.max(8, Math.floor(usableWidth / averageCharacterWidth))

  return text
    .split(/\r?\n/)
    .flatMap((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean)
      if (words.length === 0) return [""]
      const lines: string[] = []
      let line = ""
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word
        if (candidate.length <= maxCharacters || !line) {
          line = candidate
        } else {
          lines.push(line)
          line = word
        }
      }
      if (line) lines.push(line)
      return lines
    })
    .map(escapeAssText)
    .join("\\N")
}

function escapeAssText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}")
}

function alignmentFor(item: TextItem) {
  if (item.textAlign === "left") return 4
  if (item.textAlign === "right") return 6
  return 5
}

function positionFor(item: TextItem) {
  const x =
    item.textAlign === "left"
      ? item.x
      : item.textAlign === "right"
        ? item.x + item.width
        : item.x + item.width / 2
  return { x: Math.round(x), y: Math.round(item.y + item.height / 2) }
}

function shadowDepth(item: TextItem) {
  return item.textShadow && item.textShadow !== "none" ? Math.max(1, item.fontSize * 0.04) : 0
}

function styleLine(item: TextItem, index: number) {
  const hasBackground = item.backgroundMode !== "none" && Boolean(item.backgroundColor)
  const borderStyle = hasBackground ? 3 : 1
  const outline = hasBackground
    ? Math.max(item.backgroundPaddingX, item.backgroundPaddingY, 2)
    : Math.max(0, item.textStrokeWidth)

  return `Style: ${[
    `Overlay${index}`,
    resolveFontFamily(item.fontFamily),
    Math.max(1, Math.round(item.fontSize)),
    assColor(item.color, item.opacity),
    assColor(item.color, item.opacity),
    assColor(item.textStrokeColor, item.opacity),
    assColor(item.backgroundColor ?? "#000000", item.opacity),
    Number(item.fontWeight) >= 600 ? -1 : 0,
    item.fontStyle === "italic" ? -1 : 0,
    0,
    0,
    100,
    100,
    Math.round(item.letterSpacingPx),
    0,
    borderStyle,
    Math.round(outline),
    Math.round(shadowDepth(item)),
    alignmentFor(item),
    0,
    0,
    0,
    1,
  ].join(",")}`
}

function dialogueLine(item: TextItem, index: number, fps: number) {
  const { x, y } = positionFor(item)
  const tags = [`\\pos(${x},${y})`]
  if (!isNearly(item.rotation, 0)) tags.push(`\\frz${item.rotation.toFixed(2)}`)
  if (item.fadeInFrames > 0 || item.fadeOutFrames > 0) {
    tags.push(
      `\\fad(${Math.round((item.fadeInFrames / fps) * 1000)},${Math.round(
        (item.fadeOutFrames / fps) * 1000
      )})`
    )
  }

  const start = frameToAssTime(item.from, fps)
  const end = frameToAssTime(item.from + item.durationInFrames, fps)
  const text = wrapText(item)
  return `Dialogue: 0,${start},${end},Overlay${index},,0,0,0,,{${tags.join("")}}${text}`
}

export function buildFfmpegAssProject(project: EditorProject): FfmpegTextOverlayProject {
  const { sourceVideo, textItems } = validateFfmpegTextOverlayProject(project)
  const styles = textItems.map(styleLine)
  const events = textItems.map((item, index) => dialogueLine(item, index, project.settings.fps))

  return {
    ass: [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${project.settings.width}`,
      `PlayResY: ${project.settings.height}`,
      "ScaledBorderAndShadow: yes",
      "WrapStyle: 2",
      "",
      "[V4+ Styles]",
      "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
      ...styles,
      "",
      "[Events]",
      "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
      ...events,
      "",
    ].join("\n"),
    sourceVideo,
    textItems,
  }
}
