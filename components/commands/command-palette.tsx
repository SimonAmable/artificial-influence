"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { CommandItem } from "@/lib/commands/types"
import type { AtPaletteRow } from "@/lib/commands/use-command-input"
import { Badge } from "@/components/ui/badge"
import { Image, Palette, VideoCamera, Waveform } from "@phosphor-icons/react"

function PreviewOrIcon({
  src,
  fallback,
}: {
  src: string | null | undefined
  fallback: React.ReactNode
}) {
  const [failed, setFailed] = React.useState(() => !src)
  if (!src || failed) {
    return <>{fallback}</>
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="mt-0.5 size-9 shrink-0 rounded-md border border-border/60 bg-muted object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function BrandPaletteIcon({ previewUrl }: { previewUrl?: string | null }) {
  return (
    <PreviewOrIcon
      src={previewUrl}
      fallback={<Palette className="mt-0.5 size-9 shrink-0 text-foreground" weight="duotone" aria-hidden />}
    />
  )
}

function AssetPaletteIcon({
  row,
}: {
  row: Extract<AtPaletteRow, { kind: "asset" }>
}) {
  const preview = row.item.previewUrl
  const t = row.item.assetType
  const glyph =
    t === "video" ? (
      <VideoCamera className="mt-0.5 size-9 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
    ) : t === "audio" ? (
      <Waveform className="mt-0.5 size-9 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
    ) : (
      <Image className="mt-0.5 size-9 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
    )
  return <PreviewOrIcon src={preview} fallback={glyph} />
}

export interface CommandPaletteProps {
  open: boolean
  mode: "slash" | "at" | null
  slashItems: CommandItem[]
  atRows: AtPaletteRow[]
  activeIndex: number
  assetsLoading: boolean
  onSelectSlash: (item: CommandItem) => void
  onSelectAt: (row: AtPaletteRow) => void
  listRef: React.RefObject<HTMLDivElement | null>
  /**
   * When set, palette is `position: fixed` (used with a portal) so ancestors with
   * overflow:hidden cannot clip it. Omit for absolute positioning inside a relative parent.
   */
  fixedStyle?: React.CSSProperties | null
  /** Badge for text/preset slash rows (not `uiAction`); action rows use “ACTION” */
  slashCommandsContext?: string | null
}

function SlashCommandRow({
  item,
  paletteIndex,
  activeIndex,
  onSelectSlash,
  slashCommandsContext,
}: {
  item: CommandItem
  paletteIndex: number
  activeIndex: number
  onSelectSlash: (item: CommandItem) => void
  slashCommandsContext?: string | null
}) {
  const badgeLabel = item.uiAction ? "ACTION" : slashCommandsContext
  const isActive = paletteIndex === activeIndex
  return (
    <button
      type="button"
      data-palette-index={paletteIndex}
      role="option"
      aria-selected={isActive}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition-[background-color,box-shadow,border-color,color]",
        isActive
          ? "bg-background text-foreground border-border/70 shadow-[0_0_0_1px_hsl(var(--border)/0.45),0_14px_30px_-18px_hsl(var(--foreground)/0.9)]"
          : "hover:bg-muted/80"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelectSlash(item)}
    >
      <span className="flex min-w-0 w-full items-start justify-between gap-2">
        <span className="min-w-0 font-medium">{item.label}</span>
        {badgeLabel ? (
          <Badge
            variant={item.uiAction ? "outline" : "secondary"}
            aria-hidden
            className="mt-0.5 max-w-[min(9rem,42%)] shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide"
          >
            {badgeLabel}
          </Badge>
        ) : null}
      </span>
      {item.description ? (
        <span className="text-xs text-muted-foreground">{item.description}</span>
      ) : null}
    </button>
  )
}

export function CommandPalette({
  open,
  mode,
  slashItems,
  atRows,
  activeIndex,
  assetsLoading,
  onSelectSlash,
  onSelectAt,
  listRef,
  fixedStyle,
  slashCommandsContext,
}: CommandPaletteProps) {
  const slashRows = React.useMemo(
    () => slashItems.map((item, paletteIndex) => ({ item, paletteIndex })),
    [slashItems]
  )
  const presetSlashRows = React.useMemo(
    () => slashRows.filter((r) => !r.item.uiAction),
    [slashRows]
  )
  const actionSlashRows = React.useMemo(
    () => slashRows.filter((r) => Boolean(r.item.uiAction)),
    [slashRows]
  )
  const showSlashSectionLabels = presetSlashRows.length > 0 && actionSlashRows.length > 0

  React.useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector(`[data-palette-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, listRef, open])

  if (!open || !mode) return null

  return (
    <div
      className={cn(
        "flex max-h-[min(18rem,calc(100vh-12rem))] w-full min-w-[min(100%,20rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
        fixedStyle ? "fixed z-[200]" : "absolute bottom-full left-0 z-[100] mb-1"
      )}
      style={fixedStyle ?? undefined}
      role="listbox"
      aria-label={
        mode === "slash"
          ? slashCommandsContext
            ? `Commands, ${slashCommandsContext}`
            : "Commands"
          : "References"
      }
    >
      {mode === "slash" ? (
        <>
          <div className="border-b border-border/60 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Commands
          </div>
          <div ref={listRef} className="overflow-y-auto p-1">
            {slashItems.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">No matching commands</div>
            ) : (
              <>
                {showSlashSectionLabels ? (
                  <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </div>
                ) : null}
                {actionSlashRows.map(({ item, paletteIndex }) => (
                  <SlashCommandRow
                    key={item.id}
                    item={item}
                    paletteIndex={paletteIndex}
                    activeIndex={activeIndex}
                    onSelectSlash={onSelectSlash}
                    slashCommandsContext={slashCommandsContext}
                  />
                ))}
                {showSlashSectionLabels ? (
                  <>
                    <div
                      className="mx-1 my-1.5 border-t border-border/60"
                      role="separator"
                      aria-hidden
                    />
                    <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Prompts
                    </div>
                  </>
                ) : null}
                {presetSlashRows.map(({ item, paletteIndex }) => (
                  <SlashCommandRow
                    key={item.id}
                    item={item}
                    paletteIndex={paletteIndex}
                    activeIndex={activeIndex}
                    onSelectSlash={onSelectSlash}
                    slashCommandsContext={slashCommandsContext}
                  />
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-border/60 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            References
          </div>
          <div ref={listRef} className="overflow-y-auto p-1">
            {assetsLoading && atRows.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">Loading assets…</div>
            ) : atRows.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {assetsLoading ? "Loading…" : "No brand kits or assets match"}
              </div>
            ) : (
              atRows.map((row, i) => (
                <button
                  key={`${row.kind}-${row.item.id}`}
                  type="button"
                  data-palette-index={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition-[background-color,box-shadow,border-color,color]",
                    i === activeIndex
                      ? "bg-background text-foreground border-border/70 shadow-[0_0_0_1px_hsl(var(--border)/0.45),0_14px_30px_-18px_hsl(var(--foreground)/0.9)]"
                      : "hover:bg-muted/80"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectAt(row)}
                >
                  {row.kind === "brand" ? (
                    <BrandPaletteIcon previewUrl={row.item.previewUrl} />
                  ) : (
                    <AssetPaletteIcon row={row} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.item.label}</span>
                    {row.item.subtitle ? (
                      <span className="block truncate text-xs text-muted-foreground">{row.item.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
