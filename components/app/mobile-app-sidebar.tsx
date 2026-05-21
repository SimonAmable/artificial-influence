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
  SquaresFour,
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
import { cn } from "@/lib/utils"

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
  "/video": ImageIcon,
  "/chat": ChatCircleDots,
  "/automations": RobotIcon,
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

  React.useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2 [&[data-state=open]>svg.chevron]:rotate-180">
            <span className="flex-1 truncate">{group.label}</span>
            {group.badge ? <MenuBadge badge={group.badge} /> : null}
            <CaretDownIcon className="chevron ml-auto size-4 shrink-0 opacity-60 transition-transform" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            {simpleItems.length > 0 ? (
              <SidebarMenu>
                {simpleItems.map((item) => (
                  <MobileNavLink
                    key={item.path}
                    item={item}
                    pathname={pathname}
                    search={search}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            ) : null}
            {sections.map((section) => (
              <div key={section.title} className="mt-2 first:mt-0">
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                  {section.title}
                </p>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <MobileNavLink
                      key={item.path}
                      item={item}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                    />
                  ))}
                </SidebarMenu>
              </div>
            ))}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
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
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <span>{group.label}</span>
        {group.badge ? <MenuBadge badge={group.badge} /> : null}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <MobileNavLink
              key={item.path}
              item={item}
              pathname={pathname}
              search={search}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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
      <SidebarContent className="gap-0 overflow-y-auto px-2 py-3">
        {!authenticated ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"}>
                    <Link href="/" onClick={onNavigate}>
                      <House className="size-4 shrink-0" weight="duotone" aria-hidden />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {mainGroups.map((group) => {
          if (isStandaloneMegaGroup(group)) {
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <StandaloneGroupLink
                      group={group}
                      pathname={pathname}
                      search={search}
                      onNavigate={onNavigate}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
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
        <div className="flex min-h-0 flex-1 flex-col">
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
