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

type VirtualFontRowData = {
  filtered: GoogleFont[]
  value?: string
  onPick: (family: string) => void
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
        onSelect={() => onPick(font.family)}
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
  onChange: (fontFamily: string) => void
  className?: string
  showFilters?: boolean
}

export function BrandFontPicker({
  value,
  onChange,
  className,
  showFilters = true,
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

  React.useEffect(() => {
    if (value && open) void loadFont(value)
  }, [value, open])

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

  const onPick = React.useCallback(
    (family: string) => {
      onChange(family)
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
          <span className="min-w-0 truncate text-left">{value || "Select font…"}</span>
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
          {showFilters ? (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 border-zinc-700 bg-zinc-900 text-xs">
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
                value,
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
