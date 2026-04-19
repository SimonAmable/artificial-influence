"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { AttachedRef } from "@/lib/commands/types"
import { valueToParts, type MentionPart } from "@/lib/commands/mention-segments"

/** Re-export for callers that already imported from here */
export { valueToParts, type MentionPart } from "@/lib/commands/mention-segments"

/** Button size (px), keep in sync with MentionRemoveOverlay button */
export const MENTION_REMOVE_BTN_PX = 14

export type MentionControlLayout = {
  key: string
  start: number
  end: number
  refItem: AttachedRef
  /** Pill bounds in the layer (for hover hit-testing + remove button placement). */
  pillLeft: number
  pillTop: number
  pillWidth: number
  pillHeight: number
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
  /** Exact substring from the textarea (token + layout NBSP), must match textarea width for caret alignment */
  segment: string
  mentionKey: string
  start: number
  end: number
  /** When this chip is hovered, @ is hidden so the remove X can replace it visually. */
  hoveredKey: string | null
}) {
  const isBrand = refItem.category === "brand"
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
        "inline-flex max-w-max shrink-0 items-baseline gap-0 whitespace-nowrap rounded-md py-px pr-0.5 leading-snug [box-decoration-break:clone]",
        isBrand
          ? "bg-violet-500/20 text-violet-300 ring-1 ring-inset ring-violet-500/25"
          : "bg-muted/80 text-foreground ring-1 ring-inset ring-border/40"
      )}
    >
      {/** Visible @ by default; hidden on hover while the remove control draws in the same slot. */}
      <span
        className={cn("select-none", showRemoveInPlace && "text-transparent")}
        aria-hidden
      >
        @
      </span>
      <span className="whitespace-pre">{slug}</span>
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
  /** Which mention chip is hovered (shows X in place of @). */
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
      next.push({
        key: part.key,
        start: part.start,
        end: part.end,
        refItem: part.ref,
        pillLeft: sr.left - lr.left,
        pillTop: sr.top - lr.top,
        pillWidth: sr.width,
        pillHeight: sr.height,
      })
    })
    const sig = next
      .map(
        (c) =>
          `${c.key}:${Math.round(c.pillLeft)}:${Math.round(c.pillTop)}:${Math.round(c.pillWidth)}:${Math.round(c.pillHeight)}`
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
        <span className="whitespace-pre-wrap break-words leading-snug">
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
  const btn = MENTION_REMOVE_BTN_PX
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
              left: c.pillLeft + 1,
              top: c.pillTop + (c.pillHeight - btn) / 2,
              width: btn,
              height: btn,
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
            <X className="size-2.5" weight="bold" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
