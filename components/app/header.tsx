"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  User,
  CaretDownIcon,
  Coin,
  FolderSimple,
} from "@phosphor-icons/react"

import { MegaNavItemBody, MenuBadge } from "@/components/app/mega-nav-item-body"
import { MobileAppSidebar } from "@/components/app/mobile-app-sidebar"
import { cn } from "@/lib/utils"
import {
  HeaderIconButton,
  HeaderPillButton,
  headerControlSurfaceClassName,
} from "@/components/app/header-controls"
import { Button } from "@/components/ui/button"
import { SettingsDropdown } from "@/components/app/settings-dropdown"
import { GlobalSearchCommand } from "@/components/app/global-search-command"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { createClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getMegaNavGroups,
  type MegaNavGroup,
  type MegaNavItem,
} from "@/lib/constants/navigation"
import { currentProduct } from "@/lib/product/current"
import {
  ProfileSettingsModal,
  type SettingsTab,
} from "@/components/profile/profile-settings-modal"
import { useNotificationsRead } from "@/lib/notifications/use-notifications-read"

function isGroupActive(pathname: string, group: MegaNavGroup) {
  if (group.path && pathname === group.path) return true
  const items = [
    ...(group.simpleItems ?? []),
    ...((group.sections ?? []).flatMap((section) => section.items)),
  ]
  return items.some((item) => pathname === item.path.split("?")[0])
}

function HeaderMenuItem({ item, onSelect }: { item: MegaNavItem; onSelect: (path: string) => void }) {
  return (
    <DropdownMenuItem
      onClick={() => onSelect(item.path)}
      className="py-2.5"
      {...(item.modelIdentifier ? { "data-model-identifier": item.modelIdentifier } : {})}
    >
      <MegaNavItemBody item={item} />
    </DropdownMenuItem>
  )
}

function useFinePointerHoverDevice() {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    mq.addEventListener("change", onStoreChange)
    return () => mq.removeEventListener("change", onStoreChange)
  }, [])

  const getSnapshot = React.useCallback(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  )

  const getServerSnapshot = React.useCallback(() => false, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const layoutModeContext = useLayoutMode()
  const isCustomComponentsPage = pathname === "/custom-components"
  const isInpaintPage =
    pathname === "/inpaint" || pathname === "/image-editor"
  const isImagePage = pathname === "/image"
  const isMotionCopyPage = pathname === "/motion-copy"
  const isLipsyncPage = pathname === "/lipsync"
  const isCanvasPage = pathname === "/canvas"
  const isCanvasDetailPage = pathname?.startsWith("/canvas/")
  const isOnboardingPage =
    pathname === "/onboarding" || pathname?.startsWith("/onboarding/")
  const [user, setUser] = React.useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [credits, setCredits] = React.useState<number | null>(null)
  const [profileModalOpen, setProfileModalOpen] = React.useState(false)
  const [profileModalTab, setProfileModalTab] = React.useState<SettingsTab>("profile")
  const { hasUnread: notificationsUnread } = useNotificationsRead()

  const openSettingsModal = React.useCallback((tab: SettingsTab = "profile") => {
    setProfileModalTab(tab)
    setProfileModalOpen(true)
  }, [])

  const showLayoutInSettings =
    (isCustomComponentsPage ||
      isInpaintPage ||
      isImagePage ||
      isMotionCopyPage ||
      isLipsyncPage) &&
    layoutModeContext
  const [openGroupLabel, setOpenGroupLabel] = React.useState<string | null>(null)
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const supportsHoverDropdowns = useFinePointerHoverDevice()
  const megaNavGroups = React.useMemo(() => getMegaNavGroups(currentProduct), [])

  React.useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  React.useEffect(() => {
    if (!user?.id) {
      setCredits(null)
      return
    }

    const fetchCredits = async () => {
      const supabase = createClient()
      try {
        const { data } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single()
        setCredits(data?.credits ?? 0)
      } catch {
        setCredits(0)
      }
    }

    void fetchCredits()
  }, [user?.id])

  const refreshCredits = React.useCallback(async () => {
    if (!user?.id) {
      setCredits(null)
      return
    }

    const supabase = createClient()

    try {
      const { data } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single()
      setCredits(data?.credits ?? 0)
    } catch {
      setCredits(0)
    }
  }, [user?.id])

  const clearCloseTimer = React.useCallback(() => {
    if (!closeTimeoutRef.current) return
    clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = null
  }, [])

  const scheduleClose = React.useCallback(() => {
    clearCloseTimer()
    closeTimeoutRef.current = setTimeout(() => {
      setOpenGroupLabel(null)
      closeTimeoutRef.current = null
    }, 180)
  }, [clearCloseTimer])

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  if (isCanvasPage || isCanvasDetailPage || isOnboardingPage) return null

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 flex flex-col overflow-visible rounded-none pointer-events-auto"
    )}>
      <div className="flex h-[52px] min-w-0 items-center justify-between gap-2 overflow-visible px-4">
        <div className="flex min-w-0 shrink items-center gap-4 lg:gap-6">
          <Link
            href={user ? currentProduct.defaultSignedInRoute : "/"}
            className="relative flex shrink-0 items-center justify-center rounded-full p-0.5 transition-opacity hover:opacity-80"
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2",
                headerControlSurfaceClassName,
              )}
            />
            <Image
              src={currentProduct.logo}
              alt={`${currentProduct.name} logo`}
              width={currentProduct.logoSizePx ?? 32}
              height={currentProduct.logoSizePx ?? 32}
              className={
                currentProduct.logoClassName ??
                "relative z-10 h-8 w-8 dark:invert"
              }
              style={
                currentProduct.logoSizePx
                  ? { width: currentProduct.logoSizePx, height: currentProduct.logoSizePx }
                  : undefined
              }
            />
          </Link>
          {/* Desktop navigation — sheet below xl to avoid cramped tablets */}
          <nav className="hidden min-w-0 xl:flex items-center gap-2 whitespace-nowrap">
            {megaNavGroups.map((group) => {
              const active = isGroupActive(pathname, group)

              if (group.path && !group.sections?.length && !group.simpleItems?.length) {
                return (
                  <Link
                    key={group.label}
                    href={group.path}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:text-primary",
                      active && "text-primary"
                    )}
                  >
                    <span>{group.label}</span>
                    {group.badge ? <MenuBadge badge={group.badge} /> : null}
                  </Link>
                )
              }

              const isSimple = Boolean(group.simpleItems?.length)
              const widthClass = isSimple ? "w-80" : "w-[660px]"
              const groupPath = group.path ?? "#"
              const isOpen = openGroupLabel === group.label

              return (
                <DropdownMenu
                  key={group.label}
                  open={isOpen}
                  onOpenChange={(open) => {
                    clearCloseTimer()
                    setOpenGroupLabel(open ? group.label : isOpen ? null : openGroupLabel)
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    {supportsHoverDropdowns ? (
                      <div
                        onPointerEnter={() => {
                          clearCloseTimer()
                          setOpenGroupLabel(group.label)
                        }}
                        onPointerLeave={scheduleClose}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-bold text-foreground transition-colors hover:text-primary",
                          active && "text-primary"
                        )}
                      >
                        <Link href={groupPath} className="inline-flex items-center gap-2">
                          <span>{group.label}</span>
                          {group.badge ? <MenuBadge badge={group.badge} /> : null}
                        </Link>
                        <CaretDownIcon className="h-3.5 w-3.5 opacity-60" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-bold text-foreground transition-colors hover:text-primary",
                          active && "text-primary"
                        )}
                      >
                        <span>{group.label}</span>
                        {group.badge ? <MenuBadge badge={group.badge} /> : null}
                        <CaretDownIcon className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn("p-3", widthClass)}
                    onPointerEnter={() => {
                      if (!supportsHoverDropdowns) return
                      clearCloseTimer()
                      setOpenGroupLabel(group.label)
                    }}
                    onPointerLeave={() => {
                      if (!supportsHoverDropdowns) return
                      scheduleClose()
                    }}
                  >
                    {isSimple ? (
                      <div className="space-y-1">
                        {(group.simpleItems ?? []).map((item) => (
                          <HeaderMenuItem key={item.path} item={item} onSelect={(path) => router.push(path)} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {(group.sections ?? []).map((section) => (
                          <div key={section.title} className="space-y-1">
                            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {section.title}
                            </p>
                            {section.items.map((item) => (
                              <HeaderMenuItem key={item.path} item={item} onSelect={(path) => router.push(path)} />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
          </nav>
          {/* Mobile/Tablet: left sheet reuses mega menu groups (useSearchParams inside) */}
          <div className="xl:hidden">
            <React.Suspense
              fallback={
                <HeaderPillButton
                  className="justify-between gap-2"
                  disabled
                  type="button"
                >
                  <span className="min-w-16 select-none text-muted-foreground">Menu</span>
                  <CaretDownIcon className="h-4 w-4 opacity-50" />
                </HeaderPillButton>
              }
            >
              <MobileAppSidebar
                authenticated={Boolean(user)}
                onOpenProfileModal={() => openSettingsModal("profile")}
              />
            </React.Suspense>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <GlobalSearchCommand
            onOpenSettings={user ? openSettingsModal : undefined}
          />
          {loading ? null : user ? (
            <>
              <HeaderPillButton
                type="button"
                className="hidden shrink-0 items-center gap-1.5 tabular-nums sm:inline-flex"
                aria-label={
                  credits !== null
                    ? `${credits.toLocaleString()} credits — open plans and buy more`
                    : "Credits — open plans and buy more"
                }
                onClick={() => {
                  void refreshCredits()
                  openSettingsModal("credits")
                }}
              >
                <Coin
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  weight="regular"
                />
                {credits !== null ? (
                  <span>{credits.toLocaleString()}</span>
                ) : (
                  <span
                    className="inline-block h-4 w-9 animate-pulse rounded bg-muted"
                    aria-hidden
                  />
                )}
              </HeaderPillButton>
              <HeaderIconButton
                asChild
                className={
                  pathname === "/history" || pathname === "/assets"
                    ? "bg-secondary/70"
                    : undefined
                }
              >
                <Link href="/assets?tab=history" aria-label="Open library history">
                  <FolderSimple className="h-[1.2rem] w-[1.2rem]" />
                </Link>
              </HeaderIconButton>
              <HeaderIconButton
                type="button"
                className="relative"
                aria-label={
                  notificationsUnread
                    ? "Open account settings (unread notifications)"
                    : "Open account settings"
                }
                onClick={() => {
                  void refreshCredits()
                  openSettingsModal("profile")
                }}
              >
                <User className="h-[1.2rem] w-[1.2rem]" />
                {notificationsUnread ? (
                  <span
                    className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background"
                    aria-hidden
                  />
                ) : null}
              </HeaderIconButton>
            </>
          ) : (
            <>
              <Link 
                href="/login" 
                className="hidden text-sm font-medium text-primary underline-offset-4 hover:underline sm:inline"
              >
                Login
              </Link>
              <Button variant="secondary" asChild>
                <Link href="/login?mode=signup">Signup</Link>
              </Button>
            </>
          )}
          {!loading && !user ? (
            <SettingsDropdown
              layoutMode={(isCustomComponentsPage || isInpaintPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
              onLayoutModeChange={(isCustomComponentsPage || isInpaintPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
            />
          ) : null}
        </div>
      </div>
      {user ? (
        <ProfileSettingsModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          initialTab={profileModalTab}
          layoutMode={showLayoutInSettings ? layoutModeContext.layoutMode : undefined}
          onLayoutModeChange={
            showLayoutInSettings ? layoutModeContext.setLayoutMode : undefined
          }
        />
      ) : null}
    </header>
  )
}
