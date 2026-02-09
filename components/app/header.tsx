"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { User, SignOut, CaretDownIcon, ChatCircleDots } from "@phosphor-icons/react"

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
import { navigationItems } from "@/lib/constants/navigation"
import { PromotionalBanner } from "@/components/app/promotional-banner"
import { FeedbackDialog } from "@/components/app/feedback-dialog"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const layoutModeContext = useLayoutMode()
  const isCustomComponentsPage = pathname === "/custom-components"
  const isInfluencerGeneratorPage = pathname === "/influencer-generator"
  const isImagePage = pathname === "/image"
  const isMotionCopyPage = pathname === "/motion-copy"
  const isLipsyncPage = pathname === "/lipsync"
  const isAuthPage = pathname === "/login"
  const isHomePage = pathname === "/"
  const isCanvasPage = pathname === "/canvas"
  const isCanvasDetailPage = pathname?.startsWith("/canvas/")
  const [user, setUser] = React.useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [credits, setCredits] = React.useState<number | null>(null)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

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
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (isCanvasPage || isCanvasDetailPage) return null

  return (
    <header className={cn(
      "fixed z-50 flex flex-col rounded-xl border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pointer-events-auto",
      "transition-all duration-300 ease-in-out",
      isScrolled ? "shadow-lg" : "",
      isAuthPage ? "top-0 left-0 right-0 rounded-none" : isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
    )}>
      <PromotionalBanner />
      <div className="flex h-14 min-w-0 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 shrink items-center gap-4 lg:gap-6">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image 
              src="/logo.svg" 
              alt="Logo" 
              width={50} 
              height={50}
              className="h-8 w-8"
            />
          </Link>
          {/* Desktop Navigation - hidden on tablet and smaller */}
          <nav className="hidden lg:flex items-center gap-6">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "text-foreground font-bold transition-colors hover:text-primary",
                  pathname === item.path && "text-primary",
                  item.className
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Mobile/Tablet Dropdown - visible on tablet and smaller */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between gap-2">
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
            layoutMode={(isCustomComponentsPage || isInfluencerGeneratorPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
            onLayoutModeChange={(isCustomComponentsPage || isInfluencerGeneratorPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
          />
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  )
}
