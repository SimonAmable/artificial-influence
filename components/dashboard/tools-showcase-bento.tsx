"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "@radix-ui/react-icons"
import { dashboardFeatures } from "@/lib/constants/dashboard-features"

/**
 * Bento-style layout for showcasing multiple tools with screenshots/videos.
 *
 * Magic UI upgrades you can add later:
 * - Wrap the grid in <BentoGrid> and each card in <BentoCard> (bento-grid)
 * - Put each media in <Safari imageSrc={...} /> or videoSrc for browser mockup
 * - Use <HeroVideoDialog> for tools that have a demo video (thumbnail → modal)
 * - Wrap each card in <MagicCard> or <BorderBeam> for hover effects
 * - Wrap images in <Lens> for hover-to-zoom
 * See docs/MAGIC_UI_TOOLS_SHOWCASE_INSPIRATION.md
 */
export function ToolsShowcaseBento() {
  const [first, second, third, ...rest] = dashboardFeatures

  return (
    <div className="w-full space-y-4">
      <div className="grid w-full auto-rows-[22rem] grid-cols-3 gap-4">
        {/* Hero card: first tool, full width */}
        {first && (
          <ToolCard
            feature={first}
            className="col-span-3"
            size="hero"
          />
        )}

        {/* Two medium cards side by side */}
        {second && (
          <ToolCard
            feature={second}
            className="col-span-3 sm:col-span-2"
            size="medium"
          />
        )}
        {third && (
          <ToolCard
            feature={third}
            className="col-span-3 sm:col-span-1"
            size="medium"
          />
        )}

        {/* Remaining tools: equal cards */}
        {rest.map((feature) => (
          <ToolCard
            key={feature.slug}
            feature={feature}
            className="col-span-3 sm:col-span-1"
            size="small"
          />
        ))}
      </div>
    </div>
  )
}

type CardSize = "hero" | "medium" | "small"

function ToolCard({
  feature,
  className,
  size,
}: {
  feature: (typeof dashboardFeatures)[number]
  className?: string
  size: CardSize
}) {
  const isHero = size === "hero"
  const isMedium = size === "medium"

  return (
    <Link
      href={feature.toolHref}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl
        bg-background
        [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]
        dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:[border:1px_solid_rgba(255,255,255,.1)]
        transition-all duration-300 hover:shadow-lg
        ${className ?? ""}`}
    >
      {/* Media area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {feature.media.type === "video" ? (
          <video
            src={feature.media.src}
            poster={feature.media.poster}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <Image
            src={feature.media.src}
            alt={feature.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes={isHero ? "100vw" : isMedium ? "50vw" : "33vw"}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-80 pointer-events-none" />
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex flex-col gap-1 transition-all duration-300 lg:group-hover:-translate-y-1">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {feature.title}
          </h3>
          <p className="max-w-lg text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
            {feature.description}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100">
          Try it
          <ArrowRightIcon className="h-4 w-4" />
        </div>
      </div>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 bg-black/3 dark:bg-neutral-800/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Link>
  )
}
