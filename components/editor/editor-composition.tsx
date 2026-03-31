"use client"

import * as React from "react"
import { Audio, Video } from "@remotion/media"
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion"
import type {
  EditorProject,
  TextTimelineItem,
  TimelineItem,
} from "@/lib/editor/types"

interface EditorCompositionProps {
  project: EditorProject
}

function getVisualStyle(item: TimelineItem, frame: number): React.CSSProperties {
  if (item.type === "audio") {
    return {}
  }

  const fadeInFrames = Math.max(0, item.fadeInFrames)
  const fadeOutFrames = Math.max(0, item.fadeOutFrames)
  const duration = Math.max(1, item.durationInFrames)

  const fadeInOpacity =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1

  const fadeOutOpacity =
    fadeOutFrames > 0
      ? interpolate(frame, [duration - fadeOutFrames, duration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1

  if (item.type === "text") {
    return {
      position: "absolute",
      left: item.placement.x,
      top: item.placement.y,
      width: item.placement.width,
      height: item.placement.height,
      transform: `rotate(${item.placement.rotation}deg)`,
      opacity: item.placement.opacity * fadeInOpacity * fadeOutOpacity,
    }
  }

  return {
    position: "absolute",
    left: item.placement.x,
    top: item.placement.y,
    width: item.placement.width,
    height: item.placement.height,
    transform: `rotate(${item.placement.rotation}deg)`,
    opacity: item.placement.opacity * fadeInOpacity * fadeOutOpacity,
    objectFit: item.placement.objectFit,
  }
}

function TextItemRenderer({ item }: { item: TextTimelineItem }) {
  const frame = useCurrentFrame()
  const style = getVisualStyle(item, frame)

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent:
          item.style.textAlign === "left"
            ? "flex-start"
            : item.style.textAlign === "right"
              ? "flex-end"
              : "center",
        color: item.style.color,
        fontFamily: item.style.fontFamily,
        fontSize: item.style.fontSize,
        fontWeight: item.style.fontWeight,
        lineHeight: item.style.lineHeight,
        textAlign: item.style.textAlign,
        backgroundColor:
          item.style.backgroundColor === "transparent"
            ? "transparent"
            : item.style.backgroundColor,
        padding: 24,
        whiteSpace: "pre-wrap",
      }}
    >
      {item.text}
    </div>
  )
}

function VisualItemRenderer({ item }: { item: TimelineItem }) {
  const frame = useCurrentFrame()
  const style = getVisualStyle(item, frame)

  if (item.type === "image") {
    return <Img src={item.src} style={style} />
  }

  if (item.type === "video") {
    return (
      <Video
        src={item.src}
        trimBefore={item.trimStartInFrames}
        trimAfter={item.trimEndInFrames}
        playbackRate={item.playbackRate}
        volume={item.muted ? 0 : item.volume}
        style={style}
      />
    )
  }

  return null
}

export function EditorComposition({ project }: EditorCompositionProps) {
  const { fps, backgroundColor } = project.composition_settings
  const allItems = React.useMemo(() => {
    return project.timeline_state.tracks.flatMap((track) => track.items)
  }, [project.timeline_state.tracks])

  const visualItems = allItems
    .filter((item) => item.type !== "audio")
    .sort((a, b) => a.startFrame - b.startFrame)

  const audioItems = allItems
    .filter((item) => item.type === "audio")
    .sort((a, b) => a.startFrame - b.startFrame)

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {visualItems.map((item) => (
        <Sequence
          key={item.id}
          from={item.startFrame}
          durationInFrames={item.durationInFrames}
          premountFor={fps}
        >
          {item.type === "text" ? (
            <TextItemRenderer item={item} />
          ) : (
            <VisualItemRenderer item={item} />
          )}
        </Sequence>
      ))}

      {audioItems.map((item) => (
        <Sequence
          key={item.id}
          from={item.startFrame}
          durationInFrames={item.durationInFrames}
          premountFor={fps}
        >
          <Audio
            src={item.src}
            trimBefore={item.trimStartInFrames}
            trimAfter={item.trimEndInFrames}
            playbackRate={item.playbackRate}
            volume={item.muted ? 0 : item.volume}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
