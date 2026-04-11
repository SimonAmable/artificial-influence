"use client"

import * as React from "react"
import type { AttachedRef, CommandItem, ReferenceItem, SlashCommandUiAction } from "./types"
import { PRESET_COMMANDS } from "./presets"
import { getCachedAssets, getCachedBrandKits } from "./cache"
import { assetToReferenceItem, brandKitToReferenceItem } from "./reference-items"
import { makeMentionToken, mentionReserveTail } from "./mention-token"
import { valueToParts } from "./mention-segments"
import type { AssetRecord, AssetType } from "@/lib/assets/types"
import type { BrandKit } from "@/lib/brand-kit/types"

export type TriggerState =
  | { type: "slash"; start: number; end: number; filter: string }
  | { type: "at"; start: number; end: number; filter: string }

export function getTriggerState(text: string, cursor: number): TriggerState | null {
  const before = text.slice(0, cursor)
  const slash = before.match(/(^|\s)(\/)([^\s]*)$/)
  const at = before.match(/(^|\s)(@)([^\s]*)$/)
  if (slash && at) {
    const slashPos = slash.index! + slash[1].length
    const atPos = at.index! + at[1].length
    return slashPos >= atPos
      ? { type: "slash", start: slashPos, end: cursor, filter: slash[3] ?? "" }
      : { type: "at", start: atPos, end: cursor, filter: at[3] ?? "" }
  }
  if (slash) {
    return { type: "slash", start: slash.index! + slash[1].length, end: cursor, filter: slash[3] ?? "" }
  }
  if (at) {
    return { type: "at", start: at.index! + at[1].length, end: cursor, filter: at[3] ?? "" }
  }
  return null
}

function matchesFilter(label: string, subtitle: string | undefined, filter: string): boolean {
  if (!filter.trim()) return true
  const f = filter.toLowerCase()
  return (
    label.toLowerCase().includes(f) ||
    (subtitle?.toLowerCase().includes(f) ?? false)
  )
}

function filterCommandsList(commands: CommandItem[], filter: string): CommandItem[] {
  const f = filter.toLowerCase()
  return commands.filter(
    (c) =>
      matchesFilter(c.label, c.description, filter) ||
      (c.inject && c.inject.toLowerCase().includes(f))
  )
}

export type AtPaletteRow =
  | { kind: "brand"; item: ReferenceItem }
  | { kind: "asset"; item: ReferenceItem }

export function useCommandInput(options: {
  value: string
  onChange: (value: string) => void
  refs: AttachedRef[]
  onRefsChange: (refs: AttachedRef[]) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** When set, only these asset types appear in @ → assets (e.g. `["image"]` on /image) */
  allowedAssetTypes?: AssetType[]
  /** Slash palette entries; defaults to image-oriented presets */
  slashCommands?: CommandItem[]
  /** Called for slash commands with `uiAction` (create asset, brand kit, …) */
  onSlashUiAction?: (action: SlashCommandUiAction) => void
  /**
   * Inline keeps the @token in the textarea. External removes the typed trigger and
   * keeps the reference in `refs`, useful for chat attachments/pills.
   */
  referenceInsertMode?: (item: ReferenceItem) => "inline" | "external"
}) {
  const {
    value,
    onChange,
    refs,
    onRefsChange,
    textareaRef,
    allowedAssetTypes,
    slashCommands: slashCommandsOption,
    onSlashUiAction,
    referenceInsertMode,
  } = options
  const slashCommandList = slashCommandsOption ?? PRESET_COMMANDS

  const [cursor, setCursor] = React.useState(0)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [brandKits, setBrandKits] = React.useState<BrandKit[] | null>(null)
  const [assets, setAssets] = React.useState<AssetRecord[] | null>(null)
  const [assetsLoading, setAssetsLoading] = React.useState(false)

  React.useEffect(() => {
    void getCachedBrandKits()
      .then(setBrandKits)
      .catch(() => setBrandKits([]))
  }, [])

  const trigger = React.useMemo(() => getTriggerState(value, cursor), [value, cursor])

  const paletteOpen = Boolean(trigger)

  const slashItems = React.useMemo(
    () =>
      trigger?.type === "slash" ? filterCommandsList(slashCommandList, trigger.filter) : [],
    [trigger, slashCommandList]
  )

  const atRows = React.useMemo((): AtPaletteRow[] => {
    if (trigger?.type !== "at") return []
    const f = trigger.filter
    const rows: AtPaletteRow[] = []
    if (brandKits) {
      for (const kit of brandKits) {
        const item = brandKitToReferenceItem(kit)
        if (matchesFilter(item.label, item.subtitle, f)) {
          rows.push({ kind: "brand", item })
        }
      }
    }
    if (assets) {
      for (const asset of assets) {
        if (allowedAssetTypes !== undefined) {
          if (allowedAssetTypes.length === 0) continue
          if (!allowedAssetTypes.includes(asset.assetType)) continue
        }
        const item = assetToReferenceItem(asset)
        if (matchesFilter(item.label, item.subtitle, f)) {
          rows.push({ kind: "asset", item })
        }
      }
    }
    return rows
  }, [trigger, brandKits, assets, allowedAssetTypes])

  React.useEffect(() => {
    if (trigger?.type !== "at") return
    if (assets !== null) return
    setAssetsLoading(true)
    void getCachedAssets()
      .then((a) => {
        setAssets(a)
      })
      .catch(() => setAssets([]))
      .finally(() => setAssetsLoading(false))
  }, [trigger?.type, assets])

  const flatItems = trigger?.type === "slash" ? slashItems : atRows

  React.useEffect(() => {
    setActiveIndex(0)
  }, [trigger?.type, trigger?.filter, flatItems.length])

  React.useEffect(() => {
    if (activeIndex >= flatItems.length && flatItems.length > 0) {
      setActiveIndex(flatItems.length - 1)
    }
  }, [activeIndex, flatItems.length])

  const syncCursor = React.useCallback(() => {
    const el = textareaRef.current
    if (el) setCursor(el.selectionStart ?? value.length)
  }, [textareaRef, value.length])

  const applyValueAndCursor = React.useCallback(
    (newValue: string, pos: number) => {
      onChange(newValue)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(pos, pos)
          setCursor(pos)
        }
      })
    },
    [onChange, textareaRef]
  )

  const closeTrigger = React.useCallback(() => {
    const el = textareaRef.current
    const end = el?.selectionStart ?? value.length
    const t = getTriggerState(value, end)
    if (!t) return
    const next = value.slice(0, t.start) + value.slice(end)
    applyValueAndCursor(next, t.start)
  }, [applyValueAndCursor, textareaRef, value])

  const selectSlash = React.useCallback(
    (item: CommandItem) => {
      const el = textareaRef.current
      const end = el?.selectionStart ?? cursor
      const t = getTriggerState(value, end)
      if (!t || t.type !== "slash") return
      if (item.uiAction) {
        onSlashUiAction?.(item.uiAction)
        const next = value.slice(0, t.start) + value.slice(end)
        applyValueAndCursor(next, t.start)
        return
      }
      const inject = item.inject
      const next = value.slice(0, t.start) + inject + value.slice(end)
      const pos = t.start + inject.length
      applyValueAndCursor(next, pos)
    },
    [applyValueAndCursor, cursor, onSlashUiAction, textareaRef, value]
  )

  const selectAt = React.useCallback(
    (item: ReferenceItem) => {
      const el = textareaRef.current
      const end = el?.selectionStart ?? cursor
      const t = getTriggerState(value, end)
      if (!t || t.type !== "at") return
      const external = referenceInsertMode?.(item) === "external"
      const chipId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `chip-${Date.now()}-${Math.random().toString(36).slice(2)}`

      if (external) {
        const existing = refs.find((r) => r.id === item.id)
        const nextRefs = existing
          ? refs
          : ([...refs, { ...item, chipId, mentionToken: "" }] satisfies AttachedRef[])
        onRefsChange(nextRefs)
        const next = value.slice(0, t.start) + value.slice(end)
        applyValueAndCursor(next, t.start)
        return
      }

      const existing = refs.find((r) => r.id === item.id)
      const taken = new Set(refs.map((r) => r.mentionToken))
      const mentionToken = existing?.mentionToken ?? makeMentionToken(item, taken)
      const insert = mentionToken + mentionReserveTail()
      const next = value.slice(0, t.start) + insert + value.slice(end)
      const nextRefs = existing
        ? refs
        : ([...refs, { ...item, chipId, mentionToken }] satisfies AttachedRef[])
      onRefsChange(nextRefs)
      applyValueAndCursor(next, t.start + insert.length)
    },
    [applyValueAndCursor, cursor, onRefsChange, referenceInsertMode, refs, textareaRef, value]
  )

  const selectActive = React.useCallback(() => {
    if (!trigger) return
    if (trigger.type === "slash") {
      const item = slashItems[activeIndex]
      if (item) selectSlash(item)
      return
    }
    const row = atRows[activeIndex]
    if (row) selectAt(row.item)
  }, [activeIndex, atRows, selectAt, selectSlash, slashItems, trigger])

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      const sel = e.target.selectionStart ?? v.length
      setCursor(sel)
      onChange(v)
      const pruned = refs.filter((r) => !r.mentionToken || v.includes(r.mentionToken))
      if (pruned.length !== refs.length) {
        onRefsChange(pruned)
      }
    },
    [onChange, onRefsChange, refs]
  )

  const handleSelect = React.useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const t = e.target as HTMLTextAreaElement
      setCursor(t.selectionStart ?? 0)
    },
    []
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = textareaRef.current
        if (el) {
          const selStart = el.selectionStart ?? 0
          const selEnd = el.selectionEnd ?? 0
          if (selStart === selEnd && selStart > 0) {
            const deleteIndex = selStart - 1
            const parts = valueToParts(value, refs)
            for (const p of parts) {
              if (p.type === "mention" && deleteIndex >= p.start && deleteIndex < p.end) {
                e.preventDefault()
                const next = value.slice(0, p.start) + value.slice(p.end)
                onChange(next)
                const pruned = refs.filter((r) => !r.mentionToken || next.includes(r.mentionToken))
                onRefsChange(pruned)
                requestAnimationFrame(() => {
                  const ta = textareaRef.current
                  if (ta) {
                    ta.focus()
                    ta.setSelectionRange(p.start, p.start)
                    setCursor(p.start)
                  }
                })
                return
              }
            }
          }
        }
      }

      if (paletteOpen && trigger) {
        if (e.key === "Escape") {
          e.preventDefault()
          closeTrigger()
          return
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)))
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          return
        }
        if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
          if (flatItems.length > 0) {
            e.preventDefault()
            selectActive()
          }
          return
        }
      }
    },
    [
      closeTrigger,
      flatItems,
      onChange,
      onRefsChange,
      paletteOpen,
      refs,
      selectActive,
      setCursor,
      textareaRef,
      trigger,
      value,
    ]
  )

  return {
    cursor,
    setCursor,
    syncCursor,
    trigger,
    paletteOpen,
    slashItems,
    atRows,
    flatItems,
    activeIndex,
    setActiveIndex,
    assetsLoading,
    handleChange,
    handleSelect,
    handleKeyDown,
    selectSlash,
    selectAt,
    closeTrigger,
  }
}
