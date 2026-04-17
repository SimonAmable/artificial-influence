"use client"

import type { CSSProperties } from "react"
import { Audio, Video } from "@remotion/media"
import { createTikTokStyleCaptions } from "@remotion/captions"
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import type { EditorItem, EditorProject, Track } from "@/lib/video-editor/types"
import { videoTrimForRemotion } from "@/lib/video-editor/project-helpers"

type EditorCompositionProps = {
  project: EditorProject
}

export function EditorComposition({ project }: EditorCompositionProps) {
  const { width, height, fps } = project.settings

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: "#0a0a0a" }}>
      {project.tracks.map((track) => (
        <TrackLayer key={track.id} track={track} project={project} />
      ))}
    </AbsoluteFill>
  )
}

function TrackLayer({ track, project }: { track: Track; project: EditorProject }) {
  if (track.hidden) return null
  const muted = track.muted
  return (
    <>
      {track.items.map((item) => (
        <ItemSequence key={item.id} item={item} muted={muted} project={project} />
      ))}
    </>
  )
}

function ItemSequence({
  item,
  muted,
  project,
}: {
  item: EditorItem
  muted: boolean
  project: EditorProject
}) {
  const { fps } = project.settings
  const premount = fps

  return (
    <Sequence
      from={item.from}
      durationInFrames={item.durationInFrames}
      premountFor={premount}
      layout="absolute-fill"
    >
      <ItemRenderer item={item} muted={muted} />
    </Sequence>
  )
}

function ItemRenderer({ item, muted }: { item: EditorItem; muted: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const fadeIn = item.fadeInFrames
  const fadeOut = item.fadeOutFrames
  const opacityBase = item.opacity
  const fadeOpacity =
    fadeIn > 0
      ? interpolate(frame, [0, fadeIn], [0, opacityBase], { extrapolateRight: "clamp" })
      : opacityBase
  const fadeOpacity2 =
    fadeOut > 0
      ? interpolate(
          frame,
          [item.durationInFrames - fadeOut, item.durationInFrames],
          [fadeOpacity, 0],
          { extrapolateLeft: "clamp" }
        )
      : fadeOpacity

  const transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`
  const sizeStyle: CSSProperties = {
    width: item.width,
    height: item.height,
    opacity: fadeOpacity2,
    borderRadius: item.borderRadius,
    transform,
    transformOrigin: "top left",
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  }

  switch (item.type) {
    case "solid":
      return (
        <div style={{ ...sizeStyle, backgroundColor: item.fill }} />
      )
    case "image": {
      const crop = item.crop
      return (
        <div style={sizeStyle}>
          <Img
            src={item.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              ...(crop
                ? {
                    objectPosition: `${-crop.left * 100}% ${-crop.top * 100}%`,
                  }
                : {}),
            }}
          />
        </div>
      )
    }
    case "gif":
      return (
        <div style={sizeStyle}>
          <Img src={item.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )
    case "video": {
      const { trimBefore, trimAfter } = videoTrimForRemotion(item)
      const vol = muted ? 0 : item.volume * fadeOpacity2
      return (
        <div style={sizeStyle}>
          <Video
            src={item.src}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            playbackRate={item.playbackRate}
            volume={vol}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )
    }
    case "audio": {
      const trimBefore = item.trimStartFrames
      const trimAfter = item.sourceDurationFrames - item.trimEndFrames
      const vol = muted ? 0 : item.volume
      return (
        <AbsoluteFill>
          <Audio
            src={item.src}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            playbackRate={item.playbackRate}
            volume={vol}
          />
        </AbsoluteFill>
      )
    }
    case "text":
      return (
        <div
          style={{
            ...sizeStyle,
            color: item.color,
            fontFamily: item.fontFamily,
            fontSize: item.fontSize,
            fontWeight: item.fontWeight,
            fontStyle: item.fontStyle,
            textAlign: item.textAlign,
            direction: item.textDirection,
            lineHeight: item.lineHeight,
            letterSpacing: item.letterSpacingPx,
            display: "flex",
            alignItems: "center",
            justifyContent:
              item.textAlign === "left"
                ? "flex-start"
                : item.textAlign === "right"
                  ? "flex-end"
                  : "center",
            backgroundColor: item.backgroundColor ?? "transparent",
            paddingLeft: item.backgroundPaddingX,
            paddingRight: item.backgroundPaddingX,
            borderRadius: item.backgroundRadius,
            whiteSpace: "pre-wrap",
          }}
        >
          {item.text}
        </div>
      )
    case "captions": {
      const relMs = (frame / fps) * 1000
      const { pages } = createTikTokStyleCaptions({
        captions: item.captions,
        combineTokensWithinMilliseconds: item.pageDurationMs,
      })
      const page =
        pages.find((p) => relMs >= p.startMs && relMs < p.startMs + p.durationMs) ?? pages[0]
      const lineClamp = item.maxLines
      return (
        <div
          style={{
            ...sizeStyle,
            color: "#fff",
            fontFamily: item.fontFamily,
            fontSize: item.fontSize,
            textAlign: item.textAlign,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          <div
            style={{
              maxHeight: item.fontSize * 1.25 * lineClamp,
              overflow: "hidden",
            }}
          >
            {page?.tokens.map((tok, i) => {
              const active = relMs >= tok.fromMs && relMs < tok.toMs
              return (
                <span
                  key={`${tok.text}-${i}`}
                  style={{ color: active ? item.highlightColor : "#fff" }}
                >
                  {tok.text}{" "}
                </span>
              )
            })}
          </div>
        </div>
      )
    }
    default: {
      const _never: never = item
      return _never
    }
  }
}
