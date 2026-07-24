"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowSquareOut,
  Images,
  MagnifyingGlass,
  Sparkle,
  Stack,
  Video,
} from "@phosphor-icons/react"

import { MegaNavItemBody } from "@/components/app/mega-nav-item-body"
import { HeaderIconButton, HeaderPillButton } from "@/components/app/header-controls"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  searchCorePages,
  type PageSearchItem,
  type PageSearchSettingsTab,
} from "@/lib/navigation/page-search"
import { getSettingsTabItem } from "@/lib/profile/settings-tabs"
import type { Template } from "@/lib/templates/types"
import type { MegaNavItem } from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

type SearchRow =
  | { kind: "page"; item: PageSearchItem }
  | { kind: "settings"; item: PageSearchItem }
  | { kind: "template"; item: Template }

export type GlobalSearchCommandProps = {
  onOpenSettings?: (tab: PageSearchSettingsTab) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function pageToMegaNavItem(item: PageSearchItem): MegaNavItem {
  return {
    path: item.path,
    label: item.label,
    description: item.description,
    badge: item.badge,
    iconSrc: item.iconSrc,
    iconText: item.iconText ?? "/",
    iconPhosphor: item.iconPhosphor,
  }
}

function SettingsSearchItemBody({ item }: { item: PageSearchItem }) {
  const tab = item.settingsTab ? getSettingsTabItem(item.settingsTab) : null
  const Icon = tab?.icon
  const iconSrc = tab?.iconSrc ?? item.iconSrc

  return (
    <div className="flex w-full items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-muted text-foreground shadow-sm">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt={`${item.label} icon`}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : Icon ? (
          <Icon className="h-[18px] w-[18px] text-foreground" weight="regular" />
        ) : (
          <span className="text-[10px] font-bold">/</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}

function TemplatePreview({ template }: { template: Template }) {
  const fallback =
    template.thumbnail_kind === "video" || template.output_kind === "video" ? (
      <Video className="h-[18px] w-[18px]" weight="regular" />
    ) : template.output_kind === "slideshow" ? (
      <Images className="h-[18px] w-[18px]" weight="regular" />
    ) : template.category === "photo" ? (
      <Sparkle className="h-[18px] w-[18px]" weight="regular" />
    ) : (
      <Stack className="h-[18px] w-[18px]" weight="regular" />
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

export function GlobalSearchCommand({
  onOpenSettings,
  open: openProp,
  onOpenChange,
}: GlobalSearchCommandProps) {
  const router = useRouter()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = React.useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(open) : next
      if (openProp === undefined) setUncontrolledOpen(resolved)
      onOpenChange?.(resolved)
    },
    [onOpenChange, open, openProp],
  )
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
  }, [setOpen])

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

  const includeSettings = Boolean(onOpenSettings)

  const allPages = React.useMemo(
    () =>
      searchCorePages(query, {
        includeSettings,
      }),
    [includeSettings, query],
  )

  const pages = React.useMemo(
    () => allPages.filter((item) => !item.settingsTab),
    [allPages],
  )

  const settingsPages = React.useMemo(
    () => allPages.filter((item) => Boolean(item.settingsTab)),
    [allPages],
  )

  const rows = React.useMemo<SearchRow[]>(
    () => [
      ...pages.map((item) => ({ kind: "page" as const, item })),
      ...settingsPages.map((item) => ({ kind: "settings" as const, item })),
      ...templates.map((item) => ({ kind: "template" as const, item })),
    ],
    [pages, settingsPages, templates],
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
      if (row.kind === "settings") {
        const tab = row.item.settingsTab
        if (tab) onOpenSettings?.(tab)
        return
      }
      if (row.kind === "page") {
        router.push(row.item.path)
        return
      }
      router.push(`/templates/${row.item.slug}`)
    },
    [onOpenSettings, router],
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

  const noResults =
    pages.length === 0 &&
    settingsPages.length === 0 &&
    templates.length === 0 &&
    !templatesLoading

  return (
    <>
      <HeaderPillButton
        type="button"
        className="hidden min-w-0 gap-2 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass className="h-4 w-4" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </HeaderPillButton>
      <HeaderIconButton
        type="button"
        className="md:hidden"
        aria-label="Search tools and templates"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass className="h-4 w-4" />
      </HeaderIconButton>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setQuery("")
        }}
        title="Search tools and templates"
        description="Find tools, settings, and visible templates."
      >
        <CommandInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tools, settings, or templates..."
          autoFocus
          icon={<MagnifyingGlass className="h-5 w-5" />}
        />
        <CommandList>
          {noResults ? <CommandEmpty>No tools, settings, or templates found.</CommandEmpty> : null}

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

          {pages.length > 0 && settingsPages.length > 0 ? <CommandSeparator /> : null}

          {settingsPages.length > 0 ? (
            <CommandGroup heading="Settings">
              {settingsPages.map((page, settingsIndex) => {
                const rowIndex = pages.length + settingsIndex
                return (
                  <CommandItem
                    key={page.id}
                    active={activeIndex === rowIndex}
                    onMouseEnter={() => setActiveIndex(rowIndex)}
                    onClick={() => selectRow({ kind: "settings", item: page })}
                  >
                    <SettingsSearchItemBody item={page} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}

          {(pages.length > 0 || settingsPages.length > 0) &&
          (templates.length > 0 || templatesLoading) ? (
            <CommandSeparator />
          ) : null}

          {templates.length > 0 || templatesLoading ? (
            <CommandGroup heading="Templates">
              {templatesLoading && templates.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">Searching templates...</div>
              ) : null}
              {templates.map((template, templateIndex) => {
                const rowIndex = pages.length + settingsPages.length + templateIndex
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
