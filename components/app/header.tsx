"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { User, SignOut, CaretDownIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SettingsDropdown } from "@/components/app/settings-dropdown"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { createClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navigationItems = [
  { path: "/", label: "Home" },
  { path: "/image", label: "Generate Images" },

  { path: "/influencer-generator", label: "Image Editing" },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const layoutModeContext = useLayoutMode()
  const isCustomComponentsPage = pathname === "/custom-components"
  const isInfluencerGeneratorPage = pathname === "/influencer-generator"
  const isImagePage = pathname === "/image"
  const isMotionCopyPage = pathname === "/motion-copy"
  const isLipsyncPage = pathname === "/lipsync"
  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const isHomePage = pathname === "/"
  const [user, setUser] = React.useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [shouldAnimate, setShouldAnimate] = React.useState(false)

  const currentPage = navigationItems.find(item => item.path === pathname)?.path || pathname
  const isPageInDropdown = navigationItems.some(item => item.path === pathname)

  // Home page animation - sync with media timing
  // Sequence: Typing (0-1950ms) → Subtitle (1950-3450ms) → Buttons (3450-4950ms) → Header/Media (4950ms) → Lights (6950ms)
  // Header appears at the same time as media (after buttons complete), lights appear 2 seconds later
  React.useEffect(() => {
    if (isHomePage) {
      const timer = setTimeout(() => {
        setShouldAnimate(true)
      }, 4950) // Matches when media appears (after buttons complete)
      return () => clearTimeout(timer)
    } else {
      setShouldAnimate(false)
    }
  }, [isHomePage])

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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className={cn(
      "fixed z-50 rounded-xl border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pointer-events-auto",
      // Shadow: only when scrolled
      isScrolled ? "shadow-lg" : "",
      // Padding/Positioning
      isAuthPage 
        ? "top-0 left-0 right-0 rounded-none" 
        : isScrolled 
          ? "top-4 left-4 right-4" 
          : "top-0 left-0 right-0",
      // Transition classes
      isHomePage 
        ? "transition-all duration-[1500ms] ease-out" 
        : "transition-all duration-300 ease-in-out",
      // Home page animation: fade in from top
      isHomePage && !shouldAnimate && "opacity-0 -translate-y-4",
      isHomePage && shouldAnimate && "opacity-100 translate-y-0"
    )}>
      <div className="flex h-14 items-center justify-between px-4 w-full max-w-full">
        <div className="flex items-center gap-6">
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
            <Link 
              href="/influencer-generator" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/influencer-generator" && "underline"
              )}
            >
              Image Editing
            </Link>
            <Link 
              href="/image" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/image" && "underline"
              )}
            >
              Image
            </Link>
            <Link 
              href="/motion-copy" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/motion-copy" && "underline"
              )}
            >
              Motion Copy
            </Link>
            <Link 
              href="/lipsync" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/lipsync" && "underline"
              )}
            >
              Lipsync
            </Link>
          </nav>
          {/* Mobile/Tablet Dropdown - visible on tablet and smaller */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-full justify-between gap-2">
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
                      pathname === item.path && "bg-accent"
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
                <DropdownMenuContent align="end">
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
                <Link href="/signup">Signup</Link>
              </Button>
            </>
          )}
          <SettingsDropdown
            layoutMode={(isCustomComponentsPage || isInfluencerGeneratorPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
            onLayoutModeChange={(isCustomComponentsPage || isInfluencerGeneratorPage || isImagePage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
          />
        </div>
      </div>
    </header>
  )
}
