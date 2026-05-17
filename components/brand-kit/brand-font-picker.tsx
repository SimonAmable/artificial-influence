"use client"

import * as React from "react"
import { List, type RowComponentProps } from "react-window"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { GoogleFont } from "@/lib/google-fonts"
import { fetchGoogleFonts, loadFont } from "@/lib/google-fonts"

const ROW_H = 44
const LIST_H = 280
const LIST_W = 332

/** Sentinel: current font is from the Google list, not a device-font option */
const GOOGLE_LIST_SENTINEL = "__brand_font_picker_google_list__"

export type BrandFontPickerSystemFontOption = {
  label: string
  fontFamilyCss: string
}

function primaryFontFaceFromCss(fontFamilyCss: string): string {
  const token = fontFamilyCss.split(",")[0]?.trim() ?? ""
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1)
  }
  return token
}

function fontStacksEqual(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s+/g, " ")
      .trim()
  return norm(a) === norm(b)
}

function matchSystemFontOption(
  rawValue: string | undefined,
  options: readonly BrandFontPickerSystemFontOption[] | undefined,
): BrandFontPickerSystemFontOption | null {
  if (!options?.length || !rawValue?.trim()) return null
  const v = rawValue.trim()
  const vl = v.toLowerCase()
  for (const o of options) {
    if (o.label.trim().toLowerCase() === vl) return o
  }
  const vPrimary = primaryFontFaceFromCss(v).toLowerCase()
  for (const o of options) {
    if (o.label.trim().toLowerCase() === vPrimary) return o
  }
  for (const o of options) {
    const op = primaryFontFaceFromCss(o.fontFamilyCss).toLowerCase()
    if (op === vPrimary || op === vl) return o
  }
  for (const o of options) {
    if (fontStacksEqual(v, o.fontFamilyCss)) return o
  }
  return null
}

type VirtualFontRowData = {
  filtered: GoogleFont[]
  value?: string
  onPick: (font: GoogleFont) => void
}

function VirtualFontRow({
  index,
  style,
  ariaAttributes,
  filtered,
  value,
  onPick,
}: RowComponentProps<VirtualFontRowData>) {
  const font = filtered[index]
  if (!font) return null
  const isSelected = font.family === value
  return (
    <div style={style} className="px-1" {...ariaAttributes}>
      <FontRow
        font={font}
        isSelected={isSelected}
        onSelect={() => onPick(font)}
      />
    </div>
  )
}

function FontRow({
  font,
  isSelected,
  onSelect,
}: {
  font: GoogleFont
  isSelected: boolean
  onSelect: () => void
}) {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    loadFont(font.family)
      .then(() => setReady(true))
      .catch(() => setReady(true))
  }, [font.family])

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        isSelected ? "bg-primary/15 text-primary" : "hover:bg-muted/80 text-foreground",
      )}
    >
      <span className="min-w-0 truncate" style={ready ? { fontFamily: `"${font.family}", sans-serif` } : undefined}>
        {font.family}
      </span>
      {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
    </button>
  )
}

export type BrandFontPickerProps = {
  value?: string
  onChange: (
    fontFamily: string,
    font?: GoogleFont,
    systemFontCss?: string,
  ) => void
  className?: string
  showFilters?: boolean
  /** Local / web-safe stacks; shown as a compact select above the Google list */
  systemFontOptions?: readonly BrandFontPickerSystemFontOption[]
}

export function BrandFontPicker({
  value,
  onChange,
  className,
  showFilters = true,
  systemFontOptions,
}: BrandFontPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [fonts, setFonts] = React.useState<GoogleFont[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const list = await fetchGoogleFonts()
        if (!cancelled) {
          setFonts(list)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load fonts")
          setFonts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const valuePrimary = React.useMemo(
    () => (value?.trim() ? primaryFontFaceFromCss(value.trim()) : ""),
    [value],
  )

  const matchedSystemFont = React.useMemo(
    () => matchSystemFontOption(value, systemFontOptions),
    [systemFontOptions, value],
  )

  const googleListSelectedFamily = React.useMemo(() => {
    if (!value?.trim() || matchedSystemFont) return undefined
    return valuePrimary || undefined
  }, [value, valuePrimary, matchedSystemFont])

  React.useEffect(() => {
    if (!value?.trim() || !open || matchedSystemFont) return
    const face = valuePrimary || value.trim()
    void loadFont(face)
  }, [value, open, matchedSystemFont, valuePrimary])

  const categories = React.useMemo(() => {
    const u = new Set(fonts.map((f) => f.category))
    return Array.from(u).sort()
  }, [fonts])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return fonts.filter((font) => {
      const matchSearch = !q || font.family.toLowerCase().includes(q)
      const matchCat =
        !showFilters || category === "all" || font.category === category
      return matchSearch && matchCat
    })
  }, [fonts, search, category, showFilters])

  const triggerLabel =
    matchedSystemFont?.label ??
    (value?.trim() ? valuePrimary || value.trim() : undefined)

  const onPick = React.useCallback(
    (font: GoogleFont) => {
      onChange(font.family, font)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-zinc-700 bg-zinc-950/50 font-normal text-zinc-100 hover:bg-zinc-900",
            className,
          )}
        >
          <span className="min-w-0 truncate text-left">
            {triggerLabel ?? "Select font…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,380px)] border-zinc-800 bg-zinc-950 p-3 text-zinc-100"
        align="start"
      >
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Search fonts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-zinc-700 bg-zinc-900 text-sm"
          />
          {showFilters || (systemFontOptions && systemFontOptions.length > 0) ? (
            <div className="flex w-full flex-row gap-2">
              {showFilters ? (
                <div className="min-w-0 flex-1">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9 w-full border-zinc-700 bg-zinc-900 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {systemFontOptions && systemFontOptions.length > 0 ? (
                <div className="min-w-0 flex-1">
                  <Select
                    value={matchedSystemFont?.label ?? GOOGLE_LIST_SENTINEL}
                    onValueChange={(v) => {
                      if (v === GOOGLE_LIST_SENTINEL) return
                      const opt = systemFontOptions.find((o) => o.label === v)
                      if (opt) {
                        onChange(opt.label, undefined, opt.fontFamilyCss)
                        setOpen(false)
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full border-zinc-700 bg-zinc-900 text-xs">
                      <SelectValue placeholder="Device / web fonts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GOOGLE_LIST_SENTINEL}>
                        Google Fonts (list below)
                      </SelectItem>
                      {systemFontOptions.map((o) => (
                        <SelectItem
                          key={o.label}
                          value={o.label}
                          style={{ fontFamily: o.fontFamilyCss }}
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-[10px] text-zinc-500">{filtered.length} fonts</p>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading fonts…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No fonts match.</p>
          ) : (
            <List<VirtualFontRowData>
              rowComponent={VirtualFontRow}
              rowCount={filtered.length}
              rowHeight={ROW_H}
              rowProps={{
                filtered,
                value: googleListSelectedFamily,
                onPick,
              }}
              overscanCount={8}
              style={{ height: LIST_H, width: LIST_W }}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
