"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  GUIDE_SECTION_LABELS,
  GUIDE_SECTION_ORDER,
  getGuideHubCardsForProduct,
} from "@/lib/guides/content"
import { currentProduct } from "@/lib/product/current"
import { cn } from "@/lib/utils"

export function GuidesSidebar() {
  const pathname = usePathname()
  const cards = getGuideHubCardsForProduct(currentProduct.id)
  const isHub = pathname === "/guides"

  return (
    <aside className="w-full shrink-0 lg:w-52">
      <nav
        aria-label="Guides"
        className="flex flex-col gap-6 lg:sticky lg:top-24"
      >
        <Link
          href="/guides"
          className={cn(
            "text-sm transition-colors",
            isHub
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All guides
        </Link>

        {GUIDE_SECTION_ORDER.map((section) => {
          const sectionCards = cards.filter((card) => card.section === section)
          if (sectionCards.length === 0) return null

          return (
            <div key={section} className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                {GUIDE_SECTION_LABELS[section]}
              </p>
              <ul className="flex flex-col gap-1">
                {sectionCards.map((card) => {
                  const href = `/guides/${card.slug}`
                  const isActive = pathname === href

                  if (!card.available) {
                    return (
                      <li key={card.slug}>
                        <span className="block py-0.5 text-sm text-muted-foreground/45">
                          {card.title}
                        </span>
                      </li>
                    )
                  }

                  return (
                    <li key={card.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "block py-0.5 text-sm transition-colors",
                          isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
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
    </aside>
  )
}
