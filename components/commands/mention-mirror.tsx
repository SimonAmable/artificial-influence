"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { AttachedRef } from "@/lib/commands/types"
import { valueToParts, type MentionPart } from "@/lib/commands/mention-segments"

/** Re-export for callers that already imported from here */
export { valueToParts, type MentionPart } from "@/lib/commands/mention-segments"

export type MentionControlLayout = {
  key: string
  start: number
  end: number
  refItem: AttachedRef
  /** Mention bounds in the layer for hover hit-testing. */
  pillLeft: number
  pillTop: number
  pillWidth: number
  pillHeight: number
  triggerLeft: number
  triggerTop: number
  triggerWidth: number
  triggerHeight: number
}

function MentionTokenSpan({
  refItem,
  segment,
  mentionKey,
  start,
  end,
  hoveredKey,
}: {
  refItem: AttachedRef
  /** Exact substring from the textarea; the mirror must preserve this text footprint. */
  segment: string
  mentionKey: string
  start: number
  end: number
  /** When this chip is hovered, @ is hidden so the remove X can replace it visually. */
  hoveredKey: string | null
}) {
  const isBrand = refItem.category === "brand"
  const mentionColorClass = isBrand
    ? "bg-violet-500/20 text-violet-300"
    : "bg-muted/70 text-foreground"
  const token = refItem.mentionToken
  const tail = segment.slice(token.length)
  const slug = token.startsWith("@") ? token.slice(1) : token
  const showRemoveInPlace = hoveredKey === mentionKey
  return (
    <span
      data-mention-token="true"
      data-mention-key={mentionKey}
      data-mention-start={String(start)}
      data-mention-end={String(end)}
      title={refItem.label}
      className={cn(
        "rounded-sm [line-height:inherit] [box-decoration-break:clone]",
        mentionColorClass
      )}
    >
      <span
        data-mention-trigger-slot="true"
        className="relative inline-block select-none align-baseline"
        aria-hidden
      >
        <span className="text-transparent">@</span>
        {refItem.previewUrl && !showRemoveInPlace ? (
          <span
            className="absolute inset-x-0 top-1/2 inline-block -translate-y-1/2 overflow-hidden rounded-full bg-cover bg-center"
            style={{
              height: "1em",
              backgroundImage: `url("${refItem.previewUrl.replace(/"/g, '\\"')}")`,
            }}
          />
        ) : (
          <span className={cn("absolute inset-0", showRemoveInPlace && "text-transparent")}>@</span>
        )}
      </span>
      <span className={cn("rounded-sm whitespace-pre [box-decoration-break:clone]", mentionColorClass)}>{slug}</span>
      <span className="whitespace-pre text-transparent select-none" aria-hidden>
        {tail}
      </span>
    </span>
  )
}

export interface MentionMirrorProps {
  value: string
  refs: AttachedRef[]
  scrollTop: number
  mirrorMinHeight: number
  className?: string
  layerRef: React.RefObject<HTMLElement | null>
  onControlLayouts: (layouts: MentionControlLayout[]) => void
  /** Which mention is hovered (shows X in place of @). */
  hoveredKey?: string | null
}

export function MentionMirror({
  value,
  refs,
  scrollTop,
  mirrorMinHeight,
  className,
  layerRef,
  onControlLayouts,
  hoveredKey = null,
}: MentionMirrorProps) {
  const parts = React.useMemo(() => valueToParts(value, refs), [value, refs])

  const mentionByKey = React.useMemo(() => {
    const m = new Map<string, Extract<MentionPart, { type: "mention" }>>()
    for (const p of parts) {
      if (p.type === "mention") m.set(p.key, p)
    }
    return m
  }, [parts])

  const prevLayoutsRef = React.useRef<string>("")

  const measure = React.useCallback(() => {
    const layer = layerRef.current
    if (!layer) {
      if (prevLayoutsRef.current !== "") {
        prevLayoutsRef.current = ""
        onControlLayouts([])
      }
      return
    }
    const els = layer.querySelectorAll<HTMLElement>("[data-mention-token=true]")
    const lr = layer.getBoundingClientRect()
    const next: MentionControlLayout[] = []
    els.forEach((el) => {
      const key = el.dataset.mentionKey
      if (!key) return
      const part = mentionByKey.get(key)
      if (!part) return
      const sr = el.getBoundingClientRect()
      const trigger = el.querySelector<HTMLElement>("[data-mention-trigger-slot=true]")
      const tr = trigger?.getBoundingClientRect() ?? sr
      next.push({
        key: part.key,
        start: part.start,
        end: part.end,
        refItem: part.ref,
        pillLeft: sr.left - lr.left,
        pillTop: sr.top - lr.top,
        pillWidth: sr.width,
        pillHeight: sr.height,
        triggerLeft: tr.left - lr.left,
        triggerTop: tr.top - lr.top,
        triggerWidth: tr.width,
        triggerHeight: tr.height,
      })
    })
    const sig = next
      .map(
        (c) =>
          `${c.key}:${Math.round(c.pillLeft)}:${Math.round(c.pillTop)}:${Math.round(c.pillWidth)}:${Math.round(c.pillHeight)}:${Math.round(c.triggerLeft)}:${Math.round(c.triggerTop)}:${Math.round(c.triggerWidth)}:${Math.round(c.triggerHeight)}`
      )
      .join("|")
    if (sig !== prevLayoutsRef.current) {
      prevLayoutsRef.current = sig
      onControlLayouts(next)
    }
  }, [layerRef, mentionByKey, onControlLayouts])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, scrollTop, mirrorMinHeight, value])

  React.useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(layer)
    return () => ro.disconnect()
  }, [layerRef, measure])

  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} role="presentation">
      <div
        style={{
          transform: `translateY(-${scrollTop}px)`,
          minHeight: mirrorMinHeight > 0 ? mirrorMinHeight : undefined,
        }}
      >
        <span className="whitespace-pre-wrap break-words [line-height:inherit]">
          {parts.map((p) =>
            p.type === "text" ? (
              <span key={p.key}>{p.text}</span>
            ) : (
              <MentionTokenSpan
                key={p.key}
                refItem={p.ref}
                segment={value.slice(p.start, p.end)}
                mentionKey={p.key}
                start={p.start}
                end={p.end}
                hoveredKey={hoveredKey}
              />
            )
          )}
        </span>
      </div>
    </div>
  )
}

export interface MentionRemoveOverlayProps {
  layouts: MentionControlLayout[]
  onRemove: (start: number, end: number) => void
  /** When set, remove control is visible (replaces @ on hover). */
  hoveredKey: string | null
}

export function MentionRemoveOverlay({ layouts, onRemove, hoveredKey }: MentionRemoveOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {layouts.map((c) => {
        const isBrand = c.refItem.category === "brand"
        const active = hoveredKey === c.key
        return (
          <button
            key={c.key}
            type="button"
            tabIndex={-1}
            style={{
              left: c.triggerLeft,
              top: c.triggerTop,
              width: c.triggerWidth,
              height: c.triggerHeight,
            }}
            className={cn(
              "absolute inline-flex shrink-0 items-center justify-center rounded-sm",
              "text-muted-foreground transition-opacity duration-150",
              active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
              isBrand
                ? "hover:bg-violet-500/35 hover:text-violet-100"
                : "hover:bg-muted hover:text-foreground"
            )}
            aria-label={`Remove ${c.refItem.label}`}
            aria-hidden={!active}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove(c.start, c.end)
            }}
          >
            <X className="size-[0.85em]" weight="bold" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
