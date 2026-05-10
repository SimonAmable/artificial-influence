"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  User,
  SignOut,
  CaretDownIcon,
  ChatCircleDots,
  Coin,
  HandCoins,
} from "@phosphor-icons/react"

import { MegaNavItemBody, MenuBadge } from "@/components/app/mega-nav-item-body"
import { MobileMegaNavSheet } from "@/components/app/mobile-mega-nav-sheet"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SettingsDropdown, SettingsMenuContent } from "@/components/app/settings-dropdown"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { createClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  megaNavGroups,
  type MegaNavGroup,
  type MegaNavItem,
} from "@/lib/constants/navigation"
import { FeedbackDialog } from "@/components/app/feedback-dialog"
import { openPricingPlansModal } from "@/lib/pricing-upsell"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"
import { clearOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"

/** Matches signed-in header pills (credits, assets) for one surface style. */
const signedInHeaderPillClassName =
  "h-auto min-h-9 rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary/70 hover:text-foreground aria-expanded:bg-secondary/50"

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
  const isCharacterSwapPage = pathname === "/character-swap"
  const isMotionCopyPage = pathname === "/motion-copy"
  const isLipsyncPage = pathname === "/lipsync"
  const isAuthPage = pathname === "/login"
  const isCanvasPage = pathname === "/canvas"
  const isCanvasDetailPage = pathname?.startsWith("/canvas/")
  const isOnboardingPage =
    pathname === "/onboarding" || pathname?.startsWith("/onboarding/")
  const [user, setUser] = React.useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [credits, setCredits] = React.useState<number | null>(null)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const [openGroupLabel, setOpenGroupLabel] = React.useState<string | null>(null)
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [assetsMenuOpen, setAssetsMenuOpen] = React.useState(false)
  const assetsCloseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const supportsHoverDropdowns = useFinePointerHoverDevice()

  const assetsMegaGroup = React.useMemo(
    () => megaNavGroups.find((group) => group.label === "Assets"),
    []
  )
  const assetsMenuItems = assetsMegaGroup?.simpleItems ?? []

  // Scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY >= 50)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

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

  const handleLogout = async () => {
    clearOnboardingCompletedLocal(user?.id)
    if (typeof document !== "undefined") {
      document.cookie = `${ONBOARDING_DONE_COOKIE}=; path=/; max-age=0`
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

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

  const clearAssetsCloseTimer = React.useCallback(() => {
    if (!assetsCloseTimeoutRef.current) return
    clearTimeout(assetsCloseTimeoutRef.current)
    assetsCloseTimeoutRef.current = null
  }, [])

  const scheduleAssetsClose = React.useCallback(() => {
    clearAssetsCloseTimer()
    assetsCloseTimeoutRef.current = setTimeout(() => {
      setAssetsMenuOpen(false)
      assetsCloseTimeoutRef.current = null
    }, 180)
  }, [clearAssetsCloseTimer])

  React.useEffect(() => {
    return () => {
      if (assetsCloseTimeoutRef.current) {
        clearTimeout(assetsCloseTimeoutRef.current)
      }
    }
  }, [])

  if (isCanvasPage || isCanvasDetailPage || isOnboardingPage) return null

  return (
    <header className={cn(
      "fixed z-50 flex flex-col overflow-visible rounded-none bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 pointer-events-auto",
      "transition-all duration-300 ease-in-out",
      isScrolled ? "shadow-lg" : "",
      isAuthPage ? "top-0 left-0 right-0 rounded-none" : isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
    )}>
      <div className="flex h-[52px] min-w-0 items-center justify-between gap-2 overflow-visible px-4">
        <div className="flex min-w-0 shrink items-center gap-4 lg:gap-6">
          <Link
            href="/"
            className="relative flex shrink-0 items-center justify-center rounded-full p-0.5 transition-opacity hover:opacity-80"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 shadow-lg dark:bg-white/6"
            />
            <Image
              src="/logo.svg"
              alt="Logo"
              width={24}
              height={24}
              className="relative z-10 h-6 w-6 dark:invert"
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
                <Button variant="outline" className="justify-between gap-2 shadow-md" disabled type="button">
                  <span className="min-w-16 select-none text-muted-foreground">Menu</span>
                  <CaretDownIcon className="h-4 w-4 opacity-50" />
                </Button>
              }
            >
              <MobileMegaNavSheet authenticated={Boolean(user)} />
            </React.Suspense>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading ? null : user ? (
            <>
              <button
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 tabular-nums",
                  signedInHeaderPillClassName
                )}
                aria-label={
                  credits !== null
                    ? `${credits.toLocaleString()} credits — open plans and buy more`
                    : "Credits — open plans and buy more"
                }
                onClick={() => {
                  void refreshCredits()
                  openPricingPlansModal()
                }}
              >
                <Coin
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  weight="duotone"
                />
                {credits !== null ? (
                  <span>{credits.toLocaleString()}</span>
                ) : (
                  <span
                    className="inline-block h-4 w-9 animate-pulse rounded bg-muted"
                    aria-hidden
                  />
                )}
              </button>
              <DropdownMenu
                open={assetsMenuOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    clearAssetsCloseTimer()
                    setAssetsMenuOpen(false)
                  } else {
                    setAssetsMenuOpen(true)
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  {supportsHoverDropdowns ? (
                    <Button
                      variant="secondary"
                      asChild
                      className={signedInHeaderPillClassName}
                      onPointerEnter={() => {
                        clearAssetsCloseTimer()
                        setAssetsMenuOpen(true)
                      }}
                      onPointerLeave={scheduleAssetsClose}
                    >
                      <Link href="/assets">Assets</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className={signedInHeaderPillClassName}
                      aria-expanded={assetsMenuOpen}
                    >
                      Assets
                    </Button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 p-3"
                  onPointerEnter={() => {
                    if (!supportsHoverDropdowns) return
                    clearAssetsCloseTimer()
                    setAssetsMenuOpen(true)
                  }}
                  onPointerLeave={() => {
                    if (!supportsHoverDropdowns) return
                    scheduleAssetsClose()
                  }}
                >
                  <div className="space-y-1">
                    {assetsMenuItems.map((item) => (
                      <HeaderMenuItem
                        key={item.path}
                        item={item}
                        onSelect={(path) => {
                          clearAssetsCloseTimer()
                          setAssetsMenuOpen(false)
                          router.push(path)
                        }}
                      />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open) {
                    void refreshCredits()
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shadow-md">
                    <User className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                   <div className="space-y-1">
                     <div>{credits !== null ? `${credits} credits available` : "Credits unavailable"}</div>
                     {user?.email ? (
                       <div className="text-xs text-muted-foreground">{user.email}</div>
                     ) : null}
                   </div>
                 </DropdownMenuLabel>
                 <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/pricing")}>
                    <Coin className="mr-2 h-4 w-4" />
                    <span>Pricing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/affiliate")}>
                    <HandCoins className="mr-2 h-4 w-4" />
                    <span>Affiliate program</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                    <ChatCircleDots className="mr-2 h-4 w-4" />
                    <span>Send Feedback</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <SettingsMenuContent
                      layoutMode={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
                      onLayoutModeChange={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} variant="destructive">
                    <SignOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link 
                href="/login" 
                className="text-primary underline-offset-4 hover:underline text-sm font-medium"
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
              layoutMode={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
              onLayoutModeChange={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
            />
          ) : null}
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  )
}
