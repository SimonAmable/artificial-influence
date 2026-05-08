"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ArrowsLeftRight,
  CaretDownIcon,
  ChatCircleDots,
  ClockCounterClockwise,
  CurrencyDollar,
  FilmStrip,
  FlowArrow,
  House,
  Image as ImageIcon,
  Microphone as MicrophoneIcon,
  PaintBrush as PaintBrushIcon,
  PaperPlaneTilt,
  PencilSimple,
  Robot as RobotIcon,
  Palette,
  SquaresFour,
  Users,
} from "@phosphor-icons/react"

import { Collapsible, CollapsibleContent } from "@radix-ui/react-collapsible"
import { MegaNavItemBody, MenuBadge } from "@/components/app/mega-nav-item-body"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  megaNavGroups,
  navigationItems,
  type MegaNavBadge,
  type MegaNavGroup,
  type MegaNavItem,
} from "@/lib/constants/navigation"
import { cn } from "@/lib/utils"

const MOBILE_NAV_ICON_MAP: Record<string, typeof ImageIcon> = {
  "/": House,
  "/chat": ChatCircleDots,
  "/automations": RobotIcon,
  "/image": ImageIcon,
  "/video": ImageIcon,
  "/audio": MicrophoneIcon,
  "/brand": Palette,
  "/motion-copy": Users,
  "/lipsync": MicrophoneIcon,
  "/inpaint": PaintBrushIcon,
  "/character-swap": ArrowsLeftRight,
  "/canvases": FlowArrow,
  "/apps": SquaresFour,
  "/editor": FilmStrip,
  "/autopost": PaperPlaneTilt,
  "/history": ClockCounterClockwise,
  "/free-tools": PaintBrushIcon,
  "/pricing": CurrencyDollar,
  "/pricing-test": CurrencyDollar,
}

const GROUP_STANDALONE_BLURB: Partial<Record<string, string>> = {
  Audio: "Voice, music, and speech",
  Canvas: "Composable node workflows",
  Apps: "Integrated tools and experiences",
  Autopost: "Schedule and publish",
  Automations: "Hands-off creation and posting",
  Pricing: "Plans and billing",
}

/** Whether `pathname` + current search matches a mega link that may include query. */
export function megaNavPathMatches(pathname: string, currentSearch: string, targetHref: string): boolean {
  const q = targetHref.indexOf("?")
  const base = q >= 0 ? targetHref.slice(0, q) : targetHref
  if (pathname !== base) return false
  if (q < 0) return true
  const want = new URLSearchParams(targetHref.slice(q + 1))
  const have = new URLSearchParams(currentSearch)
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false
  }
  return true
}

function getMobileNavTriggerLabel(pathname: string, search: string, authenticated: boolean): string {
  if (pathname === "/") return authenticated ? "Agent" : "Home"
  for (const group of megaNavGroups) {
    const allItems = [...(group.simpleItems ?? []), ...((group.sections ?? []).flatMap((s) => s.items))]
    for (const item of allItems) {
      if (megaNavPathMatches(pathname, search, item.path)) return item.label
    }
  }
  for (const group of megaNavGroups) {
    if (group.path && megaNavPathMatches(pathname, search, group.path)) {
      return group.label
    }
  }
  const nav = navigationItems.find((i) => i.path === pathname)
  return nav?.label ?? "Tools"
}

function isPageInMegaNavigation(pathname: string, search: string, authenticated: boolean): boolean {
  if (pathname === "/") return true
  return getMobileNavTriggerLabel(pathname, search, authenticated) !== "Tools"
}

function isMegaGroupActiveForPath(pathname: string, group: MegaNavGroup): boolean {
  if (group.path && pathname === group.path.split("?")[0]) return true
  const items = [
    ...(group.simpleItems ?? []),
    ...((group.sections ?? []).flatMap((s) => s.items)),
  ]
  return items.some((item) => pathname === item.path.split("?")[0])
}

function MegaNavGroupPanel({
  group,
  pathname,
  search,
  onNavigate,
  authenticated,
  collapsible,
  open,
  onOpenChange,
  className,
  children,
}: {
  group: MegaNavGroup
  pathname: string
  search: string
  onNavigate: () => void
  authenticated: boolean
  collapsible: boolean
  open: boolean
  onOpenChange: (next: boolean) => void
  className?: string
  children: React.ReactNode
}) {
  const hubHref = group.path
  const hubActive = hubHref ? megaNavPathMatches(pathname, search, hubHref) : false

  const shellClass = cn(
    "rounded-lg border border-border/60 bg-popover/95 p-2 shadow-sm ring-1 ring-border/30",
    !collapsible && group.label === "Agent" && authenticated && "border-primary/30 ring-primary/20",
    className,
  )

  const titleBlock = hubHref ? (
    <SheetClose asChild>
      <Link
        href={hubHref}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
          "hover:bg-accent/60 active:bg-accent/70",
          hubActive && "bg-accent/50",
        )}
        onClick={onNavigate}
      >
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">{group.label}</span>
        {group.badge ? <MenuBadge badge={group.badge} /> : null}
        <span className="sr-only">Open {group.label}</span>
      </Link>
    </SheetClose>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
      {group.badge ? <MenuBadge badge={group.badge} /> : null}
    </div>
  )

  const expandButton = collapsible ? (
    <button
      type="button"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30",
        "text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent/70 hover:text-foreground",
      )}
      aria-expanded={open}
      aria-label={open ? `Collapse ${group.label}` : `Expand ${group.label}`}
      onClick={(e) => {
        e.preventDefault()
        onOpenChange(!open)
      }}
    >
      <CaretDownIcon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
    </button>
  ) : null

  const body = <div className="space-y-0.5 px-0.5 pt-1">{children}</div>

  const headerRow = (
    <div className={cn("flex min-h-10 items-stretch gap-1", (collapsible || group.label === "Agent") && "border-b border-border/45 pb-2")}>
      {titleBlock}
      {expandButton}
    </div>
  )

  if (!collapsible) {
    return (
      <div className={shellClass}>
        {headerRow}
        {body}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className={shellClass}>
        {headerRow}
        <CollapsibleContent className="overflow-hidden data-[state=closed]:hidden">{body}</CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** Flat row chrome aligned with desktop mega dropdown items (header menu rows), not heavy “pill buttons”. */
function megaMenuRowSurfaceClass(active: boolean) {
  return cn(
    "flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors",
    "border border-transparent hover:border-border/60 hover:bg-accent/60",
    active && "border-border/70 bg-accent/80",
  )
}

function MegaMenuSectionShell({
  title,
  badge,
  className,
  children,
}: {
  title: string
  badge?: MegaNavBadge
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-popover/95 p-3 shadow-sm",
        "ring-1 ring-border/30",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {badge ? <MenuBadge badge={badge} /> : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function StandaloneGroupRow({
  group,
  pathname,
  search,
  onNavigate,
}: {
  group: MegaNavGroup
  pathname: string
  search: string
  onNavigate: () => void
}) {
  const href = group.path!
  const Icon = MOBILE_NAV_ICON_MAP[href] ?? PencilSimple
  const active = megaNavPathMatches(pathname, search, href)
  const blurb = GROUP_STANDALONE_BLURB[group.label] ?? `Open ${group.label}`

  return (
    <SheetClose asChild>
      <Link href={href} className="block w-full" onClick={onNavigate}>
        <div className={megaMenuRowSurfaceClass(active)}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/80 text-foreground shadow-sm">
            <Icon size={18} weight="duotone" className="shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{group.label}</span>
              {group.badge ? <MenuBadge badge={group.badge} /> : null}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{blurb}</p>
          </div>
        </div>
      </Link>
    </SheetClose>
  )
}

function MegaSheetItemRow({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: MegaNavItem
  pathname: string
  search: string
  onNavigate: () => void
}) {
  const active = megaNavPathMatches(pathname, search, item.path)
  return (
    <SheetClose asChild>
      <Link href={item.path} className="block w-full" onClick={onNavigate}>
        <div className={megaMenuRowSurfaceClass(active)}>
          <MegaNavItemBody item={item} />
        </div>
      </Link>
    </SheetClose>
  )
}

function HomeRow({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate: () => void
}) {
  const active = pathname === "/"
  const Icon = House
  return (
    <SheetClose asChild>
      <Link href="/" className="block w-full" onClick={onNavigate}>
        <div className={megaMenuRowSurfaceClass(active)}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/80 text-foreground shadow-sm">
            <Icon size={18} weight="duotone" className="shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground">Home</span>
            <p className="text-xs text-muted-foreground">Marketing site and sign in</p>
          </div>
        </div>
      </Link>
    </SheetClose>
  )
}

export function MobileMegaNavSheet({ authenticated = false }: { authenticated?: boolean }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [sectionOpenOverrides, setSectionOpenOverrides] = React.useState<Record<string, boolean>>({})
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""

  const triggerLabel = getMobileNavTriggerLabel(pathname, search, authenticated)
  const isKnown = isPageInMegaNavigation(pathname, search, authenticated)

  const close = React.useCallback(() => setMenuOpen(false), [])

  React.useEffect(() => {
    close()
  }, [pathname, search, close])

  React.useEffect(() => {
    if (menuOpen) setSectionOpenOverrides({})
  }, [menuOpen])

  const sectionExpanded = React.useCallback(
    (group: MegaNavGroup) =>
      sectionOpenOverrides[group.label] ?? isMegaGroupActiveForPath(pathname, group),
    [pathname, sectionOpenOverrides],
  )

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <Button
        type="button"
        variant="outline"
        className="justify-between gap-2 shadow-md"
        aria-expanded={menuOpen}
        aria-controls="mobile-mega-nav-sheet"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span>{isKnown ? triggerLabel : "Tools"}</span>
        <CaretDownIcon className="h-4 w-4 opacity-50" />
      </Button>
      <SheetContent
        id="mobile-mega-nav-sheet"
        side="left"
        className={cn(
          "flex h-dvh w-[min(100vw-2rem,22rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm",
          "border border-border/70 bg-background/98 backdrop-blur-md",
        )}
      >
        <SheetHeader className="shrink-0 border-b border-border/60 bg-muted/30 px-4 py-3 text-left">
          <SheetTitle className="text-sm font-bold tracking-tight text-foreground">Menu</SheetTitle>
        </SheetHeader>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3" aria-label="Primary navigation">
          <div className="space-y-3">
            {!authenticated ? (
              <MegaMenuSectionShell title="Home">
                <HomeRow pathname={pathname} onNavigate={close} />
              </MegaMenuSectionShell>
            ) : null}

            {megaNavGroups.map((group) => {
              const isStandaloneOnly = Boolean(
                group.path && !group.sections?.length && !group.simpleItems?.length,
              )
              const simpleItemsToShow = group.simpleItems ?? []

              if (isStandaloneOnly) {
                return (
                  <MegaMenuSectionShell
                    key={group.label}
                    title={group.label}
                    {...(group.badge ? { badge: group.badge } : {})}
                  >
                    <StandaloneGroupRow group={group} pathname={pathname} search={search} onNavigate={close} />
                  </MegaMenuSectionShell>
                )
              }

              const hasSections = Boolean((group.sections ?? []).length)
              const bodyHasContent = simpleItemsToShow.length > 0 || hasSections
              const collapsible = group.label !== "Agent"

              return (
                <MegaNavGroupPanel
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  search={search}
                  onNavigate={close}
                  authenticated={authenticated}
                  collapsible={collapsible}
                  open={collapsible ? sectionExpanded(group) : true}
                  onOpenChange={
                    collapsible
                      ? (next) =>
                          setSectionOpenOverrides((m) => ({
                            ...m,
                            [group.label]: next,
                          }))
                      : () => {}
                  }
                >
                  {!bodyHasContent ? null : (
                    <>
                      {simpleItemsToShow.length > 0 ? (
                        <div className="space-y-0.5">
                          {simpleItemsToShow.map((item) => (
                            <MegaSheetItemRow
                              key={item.path}
                              item={item}
                              pathname={pathname}
                              search={search}
                              onNavigate={close}
                            />
                          ))}
                        </div>
                      ) : null}
                      {(group.sections ?? []).map((section, sIdx) => (
                        <div
                          key={section.title}
                          className={cn(
                            "space-y-0.5",
                            sIdx > 0 || simpleItemsToShow.length > 0 ? "mt-3 border-t border-border/40 pt-3" : undefined,
                          )}
                        >
                          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {section.title}
                          </p>
                          <div className="space-y-0.5">
                            {section.items.map((item) => (
                              <MegaSheetItemRow
                                key={item.path}
                                item={item}
                                pathname={pathname}
                                search={search}
                                onNavigate={close}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </MegaNavGroupPanel>
              )
            })}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
