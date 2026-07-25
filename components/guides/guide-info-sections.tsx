import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import type { GuideInfoSection, GuideLogoChip } from "@/lib/guides/types"
import { cn } from "@/lib/utils"

export function GuideLogoStrip({ logos }: { logos: GuideLogoChip[] }) {
  if (logos.length === 0) return null

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {logos.map((logo) => (
        <li
          key={`${logo.src}-${logo.label}`}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.src}
            alt=""
            className={cn(
              "size-4 object-contain",
              isAiMonochromeIconPath(logo.src) && "brightness-0 dark:invert"
            )}
          />
          <span className="text-xs font-medium tracking-tight text-foreground/90">
            {logo.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function GuideInfoSections({
  heading,
  sections,
}: {
  heading: string
  sections: GuideInfoSection[]
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-border/70 pt-8">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {heading}
      </h2>

      <div className="flex flex-col gap-8">
        {sections.map((section, index) => (
          <div key={section.title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight">{section.title}</h3>
              <div className="mt-1.5 flex flex-col gap-3">
                {section.body
                  .split(/\n\n+/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, paragraphIndex) => (
                    <p
                      key={paragraphIndex}
                      className="text-sm leading-6 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
              </div>
              {section.logos && section.logos.length > 0 ? (
                <div className="mt-3">
                  <GuideLogoStrip logos={section.logos} />
                </div>
              ) : null}
              {section.ctaHref && section.ctaLabel ? (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={section.ctaHref}>
                    {section.ctaLabel}
                    <ArrowRight data-icon="inline-end" className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
