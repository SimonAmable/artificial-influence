"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { User, SignOut } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SettingsDropdown } from "@/components/settings-dropdown"
import { useLayoutMode } from "@/components/layout-mode-context"
import { createClient } from "@/lib/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navigationItems = [
  { path: "/", label: "Home" },
  { path: "/shadcn-component-example", label: "Component Example" },
  { path: "/custom-components", label: "Custom Components" },
  { path: "/influencer-generator", label: "Influencer Generator" },
  { path: "/motion-copy", label: "Motion Copy" },
  { path: "/lipsync", label: "Lipsync" },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const layoutModeContext = useLayoutMode()
  const isCustomComponentsPage = pathname === "/custom-components"
  const isInfluencerGeneratorPage = pathname === "/influencer-generator"
  const isMotionCopyPage = pathname === "/motion-copy"
  const isLipsyncPage = pathname === "/lipsync"
  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const [user, setUser] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  const currentPage = navigationItems.find(item => item.path === pathname)?.path || pathname

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
      "fixed z-50 rounded-xl shadow-lg border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      isAuthPage ? "top-0 left-0 right-0 rounded-none" : "top-4 left-4 right-4"
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
              href="/" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/" && "underline"
              )}
            >
              Home
            </Link>
            <Link 
              href="/shadcn-component-example" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/shadcn-component-example" && "underline"
              )}
            >
              Component Example
            </Link>
            <Link 
              href="/custom-components" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/custom-components" && "underline"
              )}
            >
              Custom Components
            </Link>
            <Link 
              href="/influencer-generator" 
              className={cn(
                "text-white font-bold hover:underline",
                pathname === "/influencer-generator" && "underline"
              )}
            >
              Influencer Generator
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
            <Select
              value={currentPage}
              onValueChange={(value) => {
                router.push(value)
              }}
            >
              <SelectTrigger className="min-w-full">
                <SelectValue placeholder="Select a page" />
              </SelectTrigger>
              <SelectContent>
                {navigationItems.map((item) => (
                  <SelectItem key={item.path} value={item.path}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
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
            layoutMode={(isCustomComponentsPage || isInfluencerGeneratorPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.layoutMode : undefined}
            onLayoutModeChange={(isCustomComponentsPage || isInfluencerGeneratorPage || isMotionCopyPage || isLipsyncPage) && layoutModeContext ? layoutModeContext.setLayoutMode : undefined}
          />
        </div>
      </div>
    </header>
  )
}
