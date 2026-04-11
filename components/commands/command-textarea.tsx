"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import type { AttachedRef, CommandItem, SlashCommandUiAction } from "@/lib/commands/types"
import type { AssetType } from "@/lib/assets/types"
import { useCommandInput } from "@/lib/commands/use-command-input"
import { prefetchBrandKits } from "@/lib/commands/cache"
import { CommandPalette } from "./command-palette"
import {
  MentionMirror,
  MentionRemoveOverlay,
  type MentionControlLayout,
} from "./mention-mirror"
import type { AtPaletteRow } from "@/lib/commands/use-command-input"

export interface CommandTextareaProps {
  value: string
  onChange: (value: string) => void
  refs: AttachedRef[]
  onRefsChange: (refs: AttachedRef[]) => void
  rows?: number
  className?: string
  placeholder?: string
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPasteImage?: (file: File) => void
  /** Restrict @ → assets (e.g. only `["image"]` on /image) */
  allowedAssetTypes?: AssetType[]
  /** Slash palette: badge to the right of each command title (e.g. "Image Prompts") */
  slashCommandsContext?: string | null
  /** Override default slash entries (e.g. video presets) */
  slashCommands?: CommandItem[]
  onSlashUiAction?: (action: SlashCommandUiAction) => void
  referenceInsertMode?: (item: AtPaletteRow["item"]) => "inline" | "external"
}

export function CommandTextarea({
  value,
  onChange,
  refs,
  onRefsChange,
  rows = 3,
  className,
  placeholder,
  onPromptKeyDown,
  onPasteImage,
  allowedAssetTypes,
  slashCommandsContext,
  slashCommands,
  onSlashUiAction,
  referenceInsertMode,
}: CommandTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const layerRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [mentionLayouts, setMentionLayouts] = React.useState<MentionControlLayout[]>([])
  const [mentionHoverKey, setMentionHoverKey] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [mirrorMinHeight, setMirrorMinHeight] = React.useState(0)
  const [paletteFixedStyle, setPaletteFixedStyle] = React.useState<React.CSSProperties | null>(null)

  const {
    trigger,
    paletteOpen,
    slashItems,
    atRows,
    activeIndex,
    assetsLoading,
    handleChange,
    handleSelect,
    handleKeyDown,
    selectSlash,
    selectAt,
    syncCursor,
  } = useCommandInput({
    value,
    onChange,
    refs,
    onRefsChange,
    textareaRef,
    allowedAssetTypes,
    slashCommands,
    onSlashUiAction,
    referenceInsertMode,
  })

  const measurePalettePosition = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPaletteFixedStyle({
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + 4,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!paletteOpen) {
      setPaletteFixedStyle(null)
      return
    }
    measurePalettePosition()
  }, [measurePalettePosition, paletteOpen, value, trigger])

  React.useEffect(() => {
    if (!paletteOpen) return
    measurePalettePosition()
    const onScrollOrResize = () => measurePalettePosition()
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [measurePalettePosition, paletteOpen])

  React.useEffect(() => {
    prefetchBrandKits()
  }, [])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const syncMirrorHeight = () => {
      setMirrorMinHeight(el.scrollHeight)
    }
    syncMirrorHeight()
    const ro = new ResizeObserver(syncMirrorHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value, rows])

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items || !onPasteImage) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            e.stopPropagation()
            onPasteImage(file)
            return
          }
        }
      }
    },
    [onPasteImage]
  )

  const onKeyDownMerged = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      handleKeyDown(e)
      if (!e.defaultPrevented) {
        onPromptKeyDown?.(e)
      }
    },
    [handleKeyDown, onPromptKeyDown]
  )

  const updateMentionHoverFromPoint = React.useCallback((clientX: number, clientY: number) => {
    const layer = layerRef.current
    if (!layer) return
    let found: string | null = null
    for (const el of layer.querySelectorAll<HTMLElement>("[data-mention-token=true]")) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        found = el.dataset.mentionKey ?? null
        break
      }
    }
    setMentionHoverKey((prev) => (prev === found ? prev : found))
  }, [])

  React.useEffect(() => {
    if (mentionHoverKey && !mentionLayouts.some((l) => l.key === mentionHoverKey)) {
      setMentionHoverKey(null)
    }
  }, [mentionLayouts, mentionHoverKey])

  const removeMentionRange = React.useCallback(
    (start: number, end: number) => {
      const next = value.slice(0, start) + value.slice(end)
      const pruned = refs.filter((r) => r.mentionToken && next.includes(r.mentionToken))
      onChange(next)
      onRefsChange(pruned)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(start, start)
        }
      })
    },
    [onChange, onRefsChange, refs, value]
  )

  const mode = trigger?.type ?? null

  const paletteNode =
    mounted &&
    typeof document !== "undefined" &&
    paletteOpen &&
    mode &&
    paletteFixedStyle ? (
      <CommandPalette
        open={paletteOpen}
        mode={mode}
        slashItems={slashItems}
        atRows={atRows}
        activeIndex={activeIndex}
        assetsLoading={assetsLoading}
        onSelectSlash={selectSlash}
        onSelectAt={(row: AtPaletteRow) => selectAt(row.item)}
        listRef={listRef}
        fixedStyle={paletteFixedStyle}
        slashCommandsContext={slashCommandsContext}
      />
    ) : null

  return (
    <div className="relative flex w-full flex-col">
      {paletteNode ? createPortal(paletteNode, document.body) : null}
      <div
        ref={layerRef}
        className="relative w-full"
        onMouseMove={(e) => updateMentionHoverFromPoint(e.clientX, e.clientY)}
        onMouseLeave={() => setMentionHoverKey(null)}
      >
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <MentionMirror
            value={value}
            refs={refs}
            scrollTop={scrollTop}
            mirrorMinHeight={mirrorMinHeight}
            layerRef={layerRef}
            onControlLayouts={setMentionLayouts}
            hoveredKey={mentionHoverKey}
            className={cn(
              "box-border h-full w-full m-0 p-0 text-sm leading-snug",
              className
            )}
          />
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDownMerged}
          onSelect={handleSelect}
          onClick={syncCursor}
          onFocus={syncCursor}
          onPaste={handlePaste}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          rows={rows}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            "relative z-10 box-border m-0 w-full border-none p-0 outline-none resize-none bg-transparent text-sm leading-snug",
            "overflow-y-auto whitespace-pre-wrap break-words",
            "text-transparent caret-foreground selection:bg-primary/25",
            "placeholder:text-muted-foreground placeholder:opacity-100",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            className
          )}
          aria-autocomplete="list"
          aria-expanded={paletteOpen}
        />
        <MentionRemoveOverlay
          layouts={mentionLayouts}
          onRemove={removeMentionRange}
          hoveredKey={mentionHoverKey}
        />
      </div>
    </div>
  )
}
