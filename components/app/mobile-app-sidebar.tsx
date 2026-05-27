"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ArrowsLeftRight,
  CaretDownIcon,
  ChatCircleDots,
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
  ShieldCheck,
  SquaresFour,
  Video as VideoIcon,
} from "@phosphor-icons/react"

import { MenuBadge } from "@/components/app/mega-nav-item-body"
import { MobileNavItemIcon } from "@/components/app/mobile-nav-item-icon"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  megaNavGroups,
  type MegaNavGroup,
  type MegaNavItem,
} from "@/lib/constants/navigation"
import {
  getMobileNavTriggerLabel,
  isMegaGroupActiveForPath,
  isPageInMegaNavigation,
  isStandaloneMegaGroup,
  megaNavPathMatches,
  MOBILE_COLLAPSIBLE_GROUP_LABELS,
} from "@/lib/navigation/mobile-sidebar"

const STANDALONE_GROUP_ICON: Record<string, typeof ImageIcon> = {
  "/audio": MicrophoneIcon,
  "/canvases": FlowArrow,
  "/apps": SquaresFour,
  "/autopost": PaperPlaneTilt,
  "/pricing": CurrencyDollar,
  "/brand": Palette,
  "/motion-copy": PencilSimple,
  "/lipsync": MicrophoneIcon,
  "/inpaint": PaintBrushIcon,
  "/character-swap": ArrowsLeftRight,
  "/editor": FilmStrip,
  "/image": ImageIcon,
  "/video": VideoIcon,
  "/assets": SquaresFour,
  "/free-tools": ShieldCheck,
  "/chat": ChatCircleDots,
  "/automations": RobotIcon,
}

function getMegaNavGroupIcon(group: MegaNavGroup) {
  const base = group.path?.split("?")[0]
  if (base && STANDALONE_GROUP_ICON[base]) return STANDALONE_GROUP_ICON[base]
  return PencilSimple
}

function MegaNavGroupIcon({ group, className }: { group: MegaNavGroup; className?: string }) {
  return React.createElement(getMegaNavGroupIcon(group), {
    className,
    weight: "duotone",
    "aria-hidden": true,
  })
}

function MobileNavLink({
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
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.description}>
        <Link
          href={item.path}
          onClick={onNavigate}
          {...(item.modelIdentifier ? { "data-model-identifier": item.modelIdentifier } : {})}
        >
          <MobileNavItemIcon item={item} />
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto shrink-0">
              <MenuBadge badge={item.badge} />
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** Nested row under a collapsible group (shadcn SidebarMenuSub). */
function MobileNavSubLink({
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
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active} size="sm" title={item.description}>
        <Link
          href={item.path}
          onClick={onNavigate}
          {...(item.modelIdentifier ? { "data-model-identifier": item.modelIdentifier } : {})}
        >
          <MobileNavItemIcon item={item} />
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto shrink-0">
              <MenuBadge badge={item.badge} />
            </span>
          ) : null}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function StandaloneGroupLink({
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
  const Icon = STANDALONE_GROUP_ICON[href.split("?")[0] ?? href] ?? PencilSimple
  const active = megaNavPathMatches(pathname, search, href)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href} onClick={onNavigate}>
          <Icon className="size-4 shrink-0" weight="duotone" aria-hidden />
          <span>{group.label}</span>
          {group.badge ? (
            <span className="ml-auto shrink-0">
              <MenuBadge badge={group.badge} />
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CollapsibleNavGroup({
  group,
  pathname,
  search,
  onNavigate,
  defaultOpen,
}: {
  group: MegaNavGroup
  pathname: string
  search: string
  onNavigate: () => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const simpleItems = group.simpleItems ?? []
  const sections = group.sections ?? []
  const groupActive = isMegaGroupActiveForPath(pathname, group)

  React.useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            type="button"
            isActive={groupActive}
            className="w-full justify-start text-left"
            tooltip={group.path ? `Open ${group.label}` : undefined}
          >
            <MegaNavGroupIcon group={group} className="size-4 shrink-0" />
            <span className="truncate">{group.label}</span>
            {group.badge ? (
              <span className="shrink-0">
                <MenuBadge badge={group.badge} />
              </span>
            ) : null}
            <CaretDownIcon
              className="chevron ml-auto size-4 shrink-0 opacity-60 transition-transform group-data-[state=open]/collapsible:rotate-180 in-data-[state=open]:rotate-180"
              aria-hidden
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {simpleItems.map((item) => (
              <MobileNavSubLink
                key={item.path}
                item={item}
                pathname={pathname}
                search={search}
                onNavigate={onNavigate}
              />
            ))}
            {sections.map((section) => (
              <SidebarMenuSubItem key={section.title} className="flex flex-col gap-0.5">
                <span className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/55">
                  {section.title}
                </span>
                <SidebarMenuSub className="mx-0 w-full translate-x-0 gap-0.5 border-sidebar-border py-0 pl-2 pr-0">
                  {section.items.map((item) => (
                    <MobileNavSubLink
                      key={item.path}
                      item={item}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                    />
                  ))}
                </SidebarMenuSub>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function FlatNavGroup({
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
  const items = group.simpleItems ?? []

  return (
    <>
      <SidebarMenuItem className="pointer-events-none">
        <span className="flex h-8 items-center gap-2 px-3 text-xs font-medium text-sidebar-foreground/70">
          {group.label}
          {group.badge ? <MenuBadge badge={group.badge} /> : null}
        </span>
      </SidebarMenuItem>
      {items.map((item) => (
        <MobileNavLink
          key={item.path}
          item={item}
          pathname={pathname}
          search={search}
          onNavigate={onNavigate}
        />
      ))}
    </>
  )
}

function MobileNavSheetBody({
  authenticated,
  onNavigate,
}: {
  authenticated: boolean
  onNavigate: () => void
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""

  const footerGroups = megaNavGroups.filter((g) => g.label === "Pricing")
  const mainGroups = megaNavGroups.filter((g) => g.label !== "Pricing")

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <p className="text-sm font-semibold text-sidebar-foreground">Menu</p>
      </SidebarHeader>
      <SidebarContent className="gap-0 overflow-y-auto py-2">
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {!authenticated ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"}>
                    <Link href="/" onClick={onNavigate}>
                      <House className="size-4 shrink-0" weight="duotone" aria-hidden />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {mainGroups.map((group) => {
                if (isStandaloneMegaGroup(group)) {
                  return (
                    <StandaloneGroupLink
                      key={group.label}
                      group={group}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                    />
                  )
                }

                const hasSections = Boolean((group.sections ?? []).length)
                const collapsible =
                  MOBILE_COLLAPSIBLE_GROUP_LABELS.has(group.label) || hasSections

                if (collapsible) {
                  return (
                    <CollapsibleNavGroup
                      key={group.label}
                      group={group}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                      defaultOpen={isMegaGroupActiveForPath(pathname, group)}
                    />
                  )
                }

                return (
                  <FlatNavGroup
                    key={group.label}
                    group={group}
                    pathname={pathname}
                    search={search}
                    onNavigate={onNavigate}
                  />
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {footerGroups.length > 0 ? (
        <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
          <SidebarMenu>
            {footerGroups.map((group) =>
              group.path ? (
                <StandaloneGroupLink
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  search={search}
                  onNavigate={onNavigate}
                />
              ) : null,
            )}
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </>
  )
}

function MobileNavTriggerButton({
  authenticated,
}: {
  authenticated: boolean
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""
  const { openMobile, setOpenMobile } = useSidebar()

  const triggerLabel = getMobileNavTriggerLabel(pathname, search, authenticated)
  const isKnown = isPageInMegaNavigation(pathname, search, authenticated)

  return (
    <Button
      type="button"
      variant="outline"
      className="justify-between gap-2 shadow-md"
      aria-expanded={openMobile}
      aria-controls="mobile-app-sidebar"
      onClick={() => setOpenMobile(true)}
    >
      <span>{isKnown ? triggerLabel : "Tools"}</span>
      <CaretDownIcon className="h-4 w-4 opacity-50" />
    </Button>
  )
}

function MobileNavSheet({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""
  const { openMobile, setOpenMobile } = useSidebar()

  const close = React.useCallback(() => setOpenMobile(false), [setOpenMobile])

  React.useEffect(() => {
    close()
  }, [pathname, search, close])

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent
        id="mobile-app-sidebar"
        side="left"
        className="flex h-dvh w-[min(100vw-2rem,18rem)] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div
          data-sidebar="sidebar"
          data-mobile="true"
          className="flex min-h-0 flex-1 flex-col bg-sidebar text-sidebar-foreground"
        >
          <MobileNavSheetBody authenticated={authenticated} onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MobileAppSidebar({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <SidebarProvider defaultOpen={false} className="!min-h-0 !w-auto flex-none">
      <MobileNavTriggerButton authenticated={authenticated} />
      <MobileNavSheet authenticated={authenticated} />
    </SidebarProvider>
  )
}
