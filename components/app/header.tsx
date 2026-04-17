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
  ClockCounterClockwise,
  HandCoins,
  Image as ImageIcon,
  Video as VideoIcon,
  PaintBrush as PaintBrushIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SettingsDropdown } from "@/components/app/settings-dropdown"
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
  navigationItems,
  type MegaNavBadge,
  type MegaNavGroup,
  type MegaNavItem,
  type MegaNavPhosphorIcon,
} from "@/lib/constants/navigation"

const MEGA_NAV_PHOSPHOR: Record<MegaNavPhosphorIcon, typeof ImageIcon> = {
  image: ImageIcon,
  video: VideoIcon,
  "paint-brush": PaintBrushIcon,
}
import { FeedbackDialog } from "@/components/app/feedback-dialog"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"
import { clearOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"

function getBadgeClasses(badge: MegaNavBadge) {
  if (badge === "new") {
    return {
      pill: "bg-primary text-primary-foreground",
      ring: "ring-1 ring-primary/70 border-primary/60",
    }
  }

  return {
      pill: "bg-destructive text-destructive-foreground",
      ring: "ring-1 ring-destructive/70 border-destructive/60",
  }
}

function MenuBadge({ badge }: { badge: MegaNavBadge }) {
  const classes = getBadgeClasses(badge)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide leading-none",
        classes.pill
      )}
    >
      {badge === "new" ? "New" : "Top"}
    </span>
  )
}

function isGroupActive(pathname: string, group: MegaNavGroup) {
  if (group.path) return pathname === group.path
  const items = [
    ...(group.simpleItems ?? []),
    ...((group.sections ?? []).flatMap((section) => section.items)),
  ]
  return items.some((item) => pathname === item.path.split("?")[0])
}

function HeaderMenuItem({ item, onSelect }: { item: MegaNavItem; onSelect: (path: string) => void }) {
  const classes = item.badge ? getBadgeClasses(item.badge) : null
  const PhosphorIcon = item.iconPhosphor ? MEGA_NAV_PHOSPHOR[item.iconPhosphor] : null
  return (
    <DropdownMenuItem
      onClick={() => onSelect(item.path)}
      className="py-2.5"
      {...(item.modelIdentifier ? { "data-model-identifier": item.modelIdentifier } : {})}
    >
      <div className="flex w-full items-start gap-3">
        <div className="relative">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted text-[10px] font-bold text-foreground shadow-sm",
              classes?.ring
            )}
          >
            {item.path === "/history" ? (
              <ClockCounterClockwise className="h-[18px] w-[18px] text-foreground" weight="duotone" />
            ) : PhosphorIcon ? (
              <PhosphorIcon className="h-[18px] w-[18px] text-foreground" weight="duotone" />
            ) : item.iconSrc ? (
              <Image
                src={item.iconSrc}
                alt={`${item.label} icon`}
                width={18}
                height={18}
                className={cn(
                  "h-[18px] w-[18px] object-contain brightness-0 dark:invert",
                  item.path === "/brand" && "invert"
                )}
              />
            ) : (
              item.iconText ?? item.label.slice(0, 2).toUpperCase()
            )}
          </div>
          {item.badge ? (
            <span
              className={cn(
                "absolute left-1/2 -top-1 -translate-x-1/2 inline-flex rounded-full px-1 py-0.5 text-[8px] font-extrabold uppercase leading-none",
                classes?.pill
              )}
            >
              {item.badge === "new" ? "New" : "Top"}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </DropdownMenuItem>
  )
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
  const isHomePage = pathname === "/"
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

  const currentPage = navigationItems.find(item => item.path === pathname)?.path || pathname
  const isPageInDropdown = navigationItems.some(item => item.path === pathname)

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
    const supabase = createClient()

    const fetchCredits = async () => {
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
          {/* Desktop Navigation - hidden on tablet and smaller */}
          <nav className="hidden min-w-0 lg:flex items-center gap-2 whitespace-nowrap">
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
                    if (!open && isOpen) setOpenGroupLabel(null)
                  }}
                >
                  <DropdownMenuTrigger asChild>
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
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn("p-3", widthClass)}
                    onPointerEnter={() => {
                      clearCloseTimer()
                      setOpenGroupLabel(group.label)
                    }}
                    onPointerLeave={scheduleClose}
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
          {/* Mobile/Tablet Dropdown - visible on tablet and smaller */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-between gap-2 shadow-md"
                >
                  <span>
                    {isPageInDropdown 
                      ? navigationItems.find(item => item.path === currentPage)?.label || "Select a page"
                      : "Tools"}
                  </span>
                  <CaretDownIcon className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {navigationItems.map((item) => (
                  <DropdownMenuItem 
                    key={item.path} 
                    onClick={() => router.push(item.path)}
                    className={cn(
                      pathname === item.path && "bg-accent",
                      item.className
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading ? null : user ? (
            <>
              <Button variant="secondary" asChild>
                <Link href="/assets">Assets</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <User className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    {credits !== null ? `${credits} credits available` : "— credits"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/affiliate")}>
                    <HandCoins className="mr-2 h-4 w-4" />
                    <span>Affiliate program</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                    <ChatCircleDots className="mr-2 h-4 w-4" />
                    <span>Send Feedback</span>
                  </DropdownMenuItem>
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
          <SettingsDropdown
            layoutMode={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
            onLayoutModeChange={(isCustomComponentsPage || isInpaintPage || isImagePage || isCharacterSwapPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
          />
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  )
}
