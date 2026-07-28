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
import {
  OPEN_GLOBAL_SEARCH_EVENT,
  type OpenGlobalSearchDetail,
} from "@/lib/navigation/open-global-search"
import { getSettingsTabItem } from "@/lib/profile/settings-tabs"
import type { Template } from "@/lib/templates/types"
import type { MegaNavItem } from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

type SearchRow =
  | { kind: "page"; item: PageSearchItem }
  | { kind: "settings"; item: PageSearchItem }
  | { kind: "template"; item: Template }

type SearchSection = "all" | "core" | "settings" | "templates" | "guides"

const SEARCH_SECTIONS: Array<{ id: SearchSection; label: string }> = [
  { id: "all", label: "All" },
  { id: "core", label: "Core" },
  { id: "settings", label: "Settings" },
  { id: "templates", label: "Templates" },
  { id: "guides", label: "Guides" },
]

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
  const [activeSection, setActiveSection] = React.useState<SearchSection>("all")

  React.useEffect(() => {
    if (!open) setActiveSection("all")
  }, [open])

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
    const onOpenSearch = (event: Event) => {
      const detail = (event as CustomEvent<OpenGlobalSearchDetail>).detail
      if (typeof detail?.query === "string") {
        setQuery(detail.query)
      }
      setOpen(true)
    }

    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpenSearch)
    return () => window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpenSearch)
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
    () =>
      allPages.filter(
        (item) =>
          !item.settingsTab &&
          (!item.id.startsWith("guides:") || item.id === "guides:hub") &&
          (item.path !== "/guides" || item.id === "guides:hub"),
      ),
    [allPages],
  )

  const guidePages = React.useMemo(
    () =>
      allPages.filter(
        (item) => item.id.startsWith("guides:") && item.id !== "guides:hub",
      ),
    [allPages],
  )

  const settingsPages = React.useMemo(
    () => allPages.filter((item) => Boolean(item.settingsTab)),
    [allPages],
  )

  const visiblePages = React.useMemo(
    () => (activeSection === "all" || activeSection === "core" ? pages : []),
    [activeSection, pages],
  )
  const visibleSettings = React.useMemo(
    () =>
      activeSection === "all" || activeSection === "settings" ? settingsPages : [],
    [activeSection, settingsPages],
  )
  const visibleTemplates = React.useMemo(
    () => (activeSection === "all" || activeSection === "templates" ? templates : []),
    [activeSection, templates],
  )
  const visibleGuides = React.useMemo(
    () => (activeSection === "all" || activeSection === "guides" ? guidePages : []),
    [activeSection, guidePages],
  )

  const rows = React.useMemo<SearchRow[]>(
    () => [
      ...visiblePages.map((item) => ({ kind: "page" as const, item })),
      ...visibleSettings.map((item) => ({ kind: "settings" as const, item })),
      ...visibleTemplates.map((item) => ({ kind: "template" as const, item })),
      ...visibleGuides.map((item) => ({ kind: "page" as const, item })),
    ],
    [visibleGuides, visiblePages, visibleSettings, visibleTemplates],
  )

  React.useEffect(() => {
    setActiveIndex(0)
  }, [activeSection, query, rows.length])

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
    [onOpenSettings, router, setOpen],
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
    rows.length === 0 &&
    !(activeSection === "all" || activeSection === "templates" ? templatesLoading : false)

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
          if (!nextOpen) {
            setQuery("")
            setActiveSection("all")
          }
        }}
        title="Search tools and templates"
        description="Find tools, settings, and visible templates."
      >
        <CommandInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tools, settings, guides, or templates..."
          autoFocus
          icon={<MagnifyingGlass className="h-5 w-5" />}
        />
        <div
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/60 px-4 pb-3"
          aria-label="Search sections"
        >
          {SEARCH_SECTIONS.map((section) => {
            const selected = activeSection === section.id
            return (
              <button
                key={section.id}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "h-7 shrink-0 rounded-full border px-3 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                  selected
                    ? "border-border bg-background text-foreground shadow-md"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            )
          })}
        </div>
        <CommandList>
          {noResults ? <CommandEmpty>No tools, settings, guides, or templates found.</CommandEmpty> : null}

          {visiblePages.length > 0 ? (
            <CommandGroup heading="Core">
              {visiblePages.map((page, index) => (
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

          {visiblePages.length > 0 && visibleSettings.length > 0 ? <CommandSeparator /> : null}

          {visibleSettings.length > 0 ? (
            <CommandGroup heading="Settings">
              {visibleSettings.map((page, settingsIndex) => {
                const rowIndex = visiblePages.length + settingsIndex
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

          {(visiblePages.length > 0 || visibleSettings.length > 0) &&
          (visibleTemplates.length > 0 || templatesLoading) &&
          (activeSection === "all" || activeSection === "templates") ? (
            <CommandSeparator />
          ) : null}

          {(activeSection === "all" || activeSection === "templates") &&
          (visibleTemplates.length > 0 || templatesLoading) ? (
            <CommandGroup heading="Templates">
              {templatesLoading && visibleTemplates.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">Searching templates...</div>
              ) : null}
              {visibleTemplates.map((template, templateIndex) => {
                const rowIndex =
                  visiblePages.length + visibleSettings.length + templateIndex
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

          {visibleGuides.length > 0 &&
          (visiblePages.length > 0 ||
            visibleSettings.length > 0 ||
            visibleTemplates.length > 0) ? (
            <CommandSeparator />
          ) : null}

          {visibleGuides.length > 0 ? (
            <CommandGroup heading="Guides">
              {visibleGuides.map((page, guideIndex) => {
                const rowIndex =
                  visiblePages.length +
                  visibleSettings.length +
                  visibleTemplates.length +
                  guideIndex
                return (
                  <CommandItem
                    key={page.id}
                    active={activeIndex === rowIndex}
                    onMouseEnter={() => setActiveIndex(rowIndex)}
                    onClick={() => selectRow({ kind: "page", item: page })}
                  >
                    <MegaNavItemBody item={pageToMegaNavItem(page)} />
                    <ArrowSquareOut
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity",
                        activeIndex === rowIndex && "opacity-100",
                      )}
                    />
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
