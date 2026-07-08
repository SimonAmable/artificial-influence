"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowSquareOut,
  FlowArrow,
  Images,
  MagnifyingGlass,
  Sparkle,
  Video,
} from "@phosphor-icons/react"

import { MegaNavItemBody } from "@/components/app/mega-nav-item-body"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { searchCorePages, type PageSearchItem } from "@/lib/navigation/page-search"
import type { Template } from "@/lib/templates/types"
import type { MegaNavItem } from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

type SearchRow =
  | { kind: "page"; item: PageSearchItem }
  | { kind: "template"; item: Template }

function pageToMegaNavItem(item: PageSearchItem): MegaNavItem {
  return {
    path: item.path,
    label: item.label,
    description: item.description,
    badge: item.badge,
    iconSrc: item.iconSrc,
    iconText: item.iconText,
    iconPhosphor: item.iconPhosphor,
  }
}

function TemplatePreview({ template }: { template: Template }) {
  const fallback =
    template.thumbnail_kind === "video" || template.output_kind === "video" ? (
      <Video className="h-[18px] w-[18px]" weight="duotone" />
    ) : template.output_kind === "slideshow" ? (
      <Images className="h-[18px] w-[18px]" weight="duotone" />
    ) : template.category === "photo" ? (
      <Sparkle className="h-[18px] w-[18px]" weight="duotone" />
    ) : (
      <FlowArrow className="h-[18px] w-[18px]" weight="duotone" />
    )

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-muted text-foreground shadow-sm">
      {template.thumbnail_url ? (
        template.thumbnail_kind === "video" ? (
          <video
            src={template.thumbnail_url}
            className="h-full w-full object-cover"
            muted
            playsInline
            loop
            autoPlay
          />
        ) : (
          <span
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(template.thumbnail_url)})` }}
            aria-hidden
          />
        )
      ) : (
        fallback
      )}
      {template.thumbnail_url ? (
        <span className="pointer-events-none absolute inset-0 bg-black/10" aria-hidden />
      ) : null}
    </div>
  )
}

export function GlobalSearchCommand() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedQuery(query), 200)
    return () => window.clearTimeout(timer)
  }, [open, query])

  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()

    async function loadTemplates() {
      setTemplatesLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedQuery.trim()) params.set("search", debouncedQuery.trim())
        const response = await fetch(`/api/templates?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Failed to search templates")
        const payload = (await response.json()) as { templates?: Template[] }
        setTemplates((payload.templates ?? []).slice(0, 8))
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[global-search] template search failed:", error)
          setTemplates([])
        }
      } finally {
        if (!controller.signal.aborted) setTemplatesLoading(false)
      }
    }

    void loadTemplates()

    return () => controller.abort()
  }, [debouncedQuery, open])

  const pages = React.useMemo(
    () => searchCorePages(query, query.trim() ? 12 : 8),
    [query],
  )

  const rows = React.useMemo<SearchRow[]>(
    () => [
      ...pages.map((item) => ({ kind: "page" as const, item })),
      ...templates.map((item) => ({ kind: "template" as const, item })),
    ],
    [pages, templates],
  )

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, rows.length])

  React.useEffect(() => {
    if (activeIndex >= rows.length && rows.length > 0) {
      setActiveIndex(rows.length - 1)
    }
  }, [activeIndex, rows.length])

  const selectRow = React.useCallback(
    (row: SearchRow) => {
      setOpen(false)
      setQuery("")
      if (row.kind === "page") {
        router.push(row.item.path)
        return
      }
      router.push(`/templates/${row.item.slug}`)
    },
    [router],
  )

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)))
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === "Enter") {
        const row = rows[activeIndex]
        if (row) {
          event.preventDefault()
          selectRow(row)
        }
      }
    },
    [activeIndex, rows, selectRow],
  )

  const noResults = pages.length === 0 && templates.length === 0 && !templatesLoading

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden h-9 min-w-0 gap-2 rounded-full border-border/70 bg-secondary/40 px-3 text-muted-foreground shadow-sm backdrop-blur-md hover:bg-secondary/70 hover:text-foreground md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass className="h-4 w-4" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full border-border/70 bg-secondary/40 shadow-sm backdrop-blur-md md:hidden"
        aria-label="Search tools and templates"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass className="h-4 w-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setQuery("")
        }}
        title="Search tools and templates"
        description="Find tools and visible templates."
      >
        <CommandInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tools or templates..."
          autoFocus
          icon={<MagnifyingGlass className="h-5 w-5" />}
        />
        <CommandList>
          {noResults ? <CommandEmpty>No tools or templates found.</CommandEmpty> : null}

          {pages.length > 0 ? (
            <CommandGroup heading="Tools">
              {pages.map((page, index) => (
                <CommandItem
                  key={page.id}
                  active={activeIndex === index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectRow({ kind: "page", item: page })}
                >
                  <MegaNavItemBody item={pageToMegaNavItem(page)} />
                  <ArrowSquareOut
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity",
                      activeIndex === index && "opacity-100",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {pages.length > 0 && (templates.length > 0 || templatesLoading) ? (
            <CommandSeparator />
          ) : null}

          {templates.length > 0 || templatesLoading ? (
            <CommandGroup heading="Templates">
              {templatesLoading && templates.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">Searching templates...</div>
              ) : null}
              {templates.map((template, templateIndex) => {
                const rowIndex = pages.length + templateIndex
                return (
                  <CommandItem
                    key={template.id}
                    active={activeIndex === rowIndex}
                    onMouseEnter={() => setActiveIndex(rowIndex)}
                    onClick={() => selectRow({ kind: "template", item: template })}
                  >
                    <TemplatePreview template={template} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {template.title}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {template.description || template.slug}
                      </p>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
