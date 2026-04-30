"use client"

import type { CSSProperties } from "react"
import { createTikTokStyleCaptions } from "@remotion/captions"
import { Audio, Video } from "@remotion/media"
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { videoTrimForRemotion } from "../project-helpers"
import type { EditorItem, EditorProject, Track } from "../types"
import type { TimelineCompositionProps } from "./metadata"

export function TimelineComposition({ project }: TimelineCompositionProps) {
  const { width, height } = project.settings

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: "#0a0a0a" }}>
      {project.tracks.map((track) => (
        <TrackLayer key={track.id} track={track} project={project} />
      ))}
    </AbsoluteFill>
  )
}

function TrackLayer({
  track,
  project,
}: {
  track: Track
  project: EditorProject
}) {
  if (track.hidden) {
    return null
  }

  return (
    <>
      {track.items.map((item) => (
        <ItemSequence
          key={item.id}
          item={item}
          muted={track.muted}
          project={project}
        />
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
  const premount = project.settings.fps

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

  const fadeInOpacity =
    item.fadeInFrames > 0
      ? interpolate(frame, [0, item.fadeInFrames], [0, item.opacity], {
          extrapolateRight: "clamp",
        })
      : item.opacity

  const opacity =
    item.fadeOutFrames > 0
      ? interpolate(
          frame,
          [item.durationInFrames - item.fadeOutFrames, item.durationInFrames],
          [fadeInOpacity, 0],
          { extrapolateLeft: "clamp" }
        )
      : fadeInOpacity

  const sizeStyle: CSSProperties = {
    width: item.width,
    height: item.height,
    opacity,
    borderRadius: item.borderRadius,
    transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,
    transformOrigin: "top left",
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  }

  switch (item.type) {
    case "solid":
      return <div style={{ ...sizeStyle, backgroundColor: item.fill }} />
    case "image": {
      return (
        <div style={sizeStyle}>
          <Img
            src={item.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              ...(item.crop
                ? {
                    objectPosition: `${-item.crop.left * 100}% ${-item.crop.top * 100}%`,
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
          <Img
            src={item.src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )
    case "video": {
      const { trimBefore, trimAfter } = videoTrimForRemotion(item)
      const volume = muted ? 0 : item.volume * opacity

      return (
        <div style={sizeStyle}>
          <Video
            src={item.src}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            playbackRate={item.playbackRate}
            volume={volume}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )
    }
    case "audio": {
      const trimBefore = item.trimStartFrames
      const trimAfter = item.sourceDurationFrames - item.trimEndFrames
      const volume = muted ? 0 : item.volume

      return (
        <AbsoluteFill>
          <Audio
            src={item.src}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            playbackRate={item.playbackRate}
            volume={volume}
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
      const relativeTimeMs = (frame / fps) * 1000
      const { pages } = createTikTokStyleCaptions({
        captions: item.captions,
        combineTokensWithinMilliseconds: item.pageDurationMs,
      })
      const page =
        pages.find(
          (candidate) =>
            relativeTimeMs >= candidate.startMs &&
            relativeTimeMs < candidate.startMs + candidate.durationMs
        ) ?? pages[0]

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
              maxHeight: item.fontSize * 1.25 * item.maxLines,
              overflow: "hidden",
            }}
          >
            {page?.tokens.map((token, index) => {
              const isActive =
                relativeTimeMs >= token.fromMs && relativeTimeMs < token.toMs

              return (
                <span
                  key={`${token.text}-${index}`}
                  style={{ color: isActive ? item.highlightColor : "#fff" }}
                >
                  {token.text}{" "}
                </span>
              )
            })}
          </div>
        </div>
      )
    }
    default: {
      const exhaustiveCheck: never = item
      return exhaustiveCheck
    }
  }
}
