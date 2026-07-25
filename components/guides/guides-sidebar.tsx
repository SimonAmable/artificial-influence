"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { List } from "@phosphor-icons/react"

import {
  GUIDE_SECTION_LABELS,
  GUIDE_SECTION_ORDER,
  getGuideHubCardsForProduct,
} from "@/lib/guides/content"
import type { GuideHubCard, GuideSectionId } from "@/lib/guides/types"
import { currentProduct } from "@/lib/product/current"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

function GuidesNav({
  cards,
  pathname,
  isHub,
  onNavigate,
}: {
  cards: GuideHubCard[]
  pathname: string
  isHub: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Guides" className="flex flex-col gap-6">
      <Link
        href="/guides"
        onClick={onNavigate}
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          isHub
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        All guides
      </Link>

      {GUIDE_SECTION_ORDER.map((section: GuideSectionId) => {
        const sectionCards = cards.filter((card) => card.section === section)
        if (sectionCards.length === 0) return null

        return (
          <div key={section} className="flex flex-col gap-1">
            <p className="px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
              {GUIDE_SECTION_LABELS[section]}
            </p>
            <ul className="flex flex-col gap-0.5">
              {sectionCards.map((card) => {
                const href = `/guides/${card.slug}`
                const isActive = pathname === href

                if (!card.available) {
                  return (
                    <li key={card.slug}>
                      <span className="block rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground/45">
                        {card.title}
                      </span>
                    </li>
                  )
                }

                return (
                  <li key={card.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {card.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function GuidesSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const cards = getGuideHubCardsForProduct(currentProduct.id)
  const isHub = pathname === "/guides"
  const closeMobile = React.useCallback(() => setMobileOpen(false), [])

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <List className="size-4" />
              Guides
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,20rem)] overflow-y-auto p-0">
            <SheetHeader className="border-b border-border/60 p-4 text-left">
              <SheetTitle>Guides</SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <GuidesNav
                cards={cards}
                pathname={pathname}
                isHub={isHub}
                onNavigate={closeMobile}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden w-56 shrink-0 lg:block xl:w-60">
        <div className="sticky top-24">
          <GuidesNav cards={cards} pathname={pathname} isHub={isHub} />
        </div>
      </aside>
    </>
  )
}
