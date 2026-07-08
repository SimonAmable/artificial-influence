"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  CaretDownIcon,
  ChatCircleDots,
  CurrencyDollar,
  FlowArrow,
  Microphone as MicrophoneIcon,
  Palette,
  PaperPlaneTilt,
  PencilSimple,
  Robot as RobotIcon,
  ShieldCheck,
  SquaresFour,
  Image as ImageIcon,
  Video as VideoIcon,
  FolderSimple,
  MagnifyingGlass,
  User,
} from "@phosphor-icons/react"

import { MenuBadge } from "@/components/app/mega-nav-item-body"
import { Button } from "@/components/ui/button"
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
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  getMobileNavTriggerLabel,
  isPageInMegaNavigation,
  megaNavPathMatches,
} from "@/lib/navigation/mobile-sidebar"
import { currentProduct } from "@/lib/product/current"
import type { ProductId } from "@/lib/product/types"
import { isRouteVisibleForProduct, isVisibleByProductMetadata } from "@/lib/product/visibility"

// ─── Nav item definitions ────────────────────────────────────────────────────

type NavBadge = "new" | "beta"

interface FlatNavItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: NavBadge
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

const FLAT_NAV_ITEMS: FlatNavItem[] = [
  { path: "/chat",          label: "Agent",         icon: ChatCircleDots,  badge: "beta" },
  { path: "/automations",   label: "Automations",   icon: RobotIcon,       badge: "beta" },
  { path: "/templates",     label: "Templates",     icon: FlowArrow,       badge: "new"  },
  { path: "/slideshows",    label: "Slideshows",    icon: SquaresFour,     badge: "new"  },
  { path: "/content",       label: "Content",       icon: Palette,         badge: "new", products: ["presence-studio"] },
  { path: "/autopost",      label: "Autopost",      icon: PaperPlaneTilt,  badge: "new", hiddenFor: ["presence-studio"] },
  { path: "/ai-influencer", label: "AI Influencer", icon: RobotIcon,       badge: "new"  },
  { path: "/explore",       label: "Explore",       icon: MagnifyingGlass, badge: "new"  },
  { path: "/image",         label: "Image",         icon: ImageIcon                      },
  { path: "/video",         label: "Video",         icon: VideoIcon                      },
  { path: "/audio",         label: "Audio",         icon: MicrophoneIcon                 },
  { path: "/assets",        label: "Assets",        icon: FolderSimple,    badge: "new"  },
  { path: "/canvases",      label: "Canvas",        icon: PencilSimple                   },
  { path: "/free-tools",    label: "Free Tools",    icon: ShieldCheck                   },
  { path: "/pricing",       label: "Pricing",       icon: CurrencyDollar                },
]

function getMobileFlatNavItems(product = currentProduct): FlatNavItem[] {
  return FLAT_NAV_ITEMS.filter(
    (item) =>
      isVisibleByProductMetadata(item, product.id) &&
      isRouteVisibleForProduct(item.path, product),
  )
}

// ─── Single nav item ──────────────────────────────────────────────────────────

function FlatNavLink({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: FlatNavItem
  pathname: string
  search: string
  onNavigate: () => void
}) {
  const active = megaNavPathMatches(pathname, search, item.path)
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={item.path} onClick={onNavigate}>
          <Icon className="size-4 shrink-0" weight="duotone" aria-hidden />
          <span className="truncate font-bold">{item.label}</span>
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

// ─── Sidebar body ─────────────────────────────────────────────────────────────

function MobileNavSheetBody({
  authenticated,
  onNavigate,
  onOpenProfileModal,
}: {
  authenticated: boolean
  onNavigate: () => void
  onOpenProfileModal?: () => void
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""

  const sidebarLogoSize = currentProduct.logoSizePx ?? 22

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link
          href={authenticated ? currentProduct.defaultSignedInRoute : "/"}
          className="flex min-w-0 items-center gap-2.5"
          onClick={onNavigate}
        >
          <Image
            src={currentProduct.logo}
            alt={`${currentProduct.name} logo`}
            width={sidebarLogoSize}
            height={sidebarLogoSize}
            className={currentProduct.logoClassName ?? "h-[22px] w-[22px] shrink-0 dark:invert"}
            style={
              currentProduct.logoSizePx
                ? { width: sidebarLogoSize, height: sidebarLogoSize }
                : undefined
            }
          />
          <span
            className={
              currentProduct.logoSizePx
                ? "min-w-0 truncate font-brand text-lg font-semibold uppercase leading-none tracking-[0.14em] text-sidebar-foreground"
                : "min-w-0 truncate font-brand text-sm font-semibold uppercase tracking-[0.12em] text-sidebar-foreground"
            }
            style={
              currentProduct.logoSizePx
                ? { lineHeight: `${sidebarLogoSize}px` }
                : undefined
            }
          >
            {currentProduct.name}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto py-2">
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {getMobileFlatNavItems().map((item) => (
                <FlatNavLink
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
      </SidebarContent>

      {authenticated ? (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                className="w-full"
                onClick={() => {
                  onNavigate()
                  onOpenProfileModal?.()
                }}
              >
                <User className="size-4 shrink-0" weight="duotone" aria-hidden />
                <span className="font-bold">Profile &amp; settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </>
  )
}

// ─── Trigger button ───────────────────────────────────────────────────────────

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

// ─── Sheet wrapper ────────────────────────────────────────────────────────────

function MobileNavSheet({
  authenticated,
  onOpenProfileModal,
}: {
  authenticated: boolean
  onOpenProfileModal?: () => void
}) {
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
          <MobileNavSheetBody
            authenticated={authenticated}
            onNavigate={close}
            onOpenProfileModal={onOpenProfileModal}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function MobileAppSidebar({
  authenticated = false,
  onOpenProfileModal,
}: {
  authenticated?: boolean
  onOpenProfileModal?: () => void
}) {
  return (
    <SidebarProvider defaultOpen={false} className="!min-h-0 !w-auto flex-none">
      <MobileNavTriggerButton authenticated={authenticated} />
      <MobileNavSheet
        authenticated={authenticated}
        onOpenProfileModal={onOpenProfileModal}
      />
    </SidebarProvider>
  )
}
