"use client"

import { Fragment, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"

import { ShaderDemoCard } from "@/components/ui/shader-demo-card"
import { cn } from "@/lib/utils"

export type OptionRelation = "or" | "and" | "steps"

export type OptionItem = {
  title: string
  description: string
  href: string
  /** Optional CTA label; defaults to title for card button. */
  ctaLabel?: string
  meta?: string
  mediaSrc?: string
  mediaAlt?: string
}

export type OptionGroupProps = {
  heading: string
  relation: OptionRelation
  items: OptionItem[]
  className?: string
}

function relationLabel(relation: Exclude<OptionRelation, "steps">): string {
  switch (relation) {
    case "or":
      return "or"
    case "and":
      return "and"
    default: {
      const _exhaustive: never = relation
      return _exhaustive
    }
  }
}

const CONNECTOR_WIDTH_REM = 2.75

function ConnectorLabel({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
      {label}
    </span>
  )
}

/** Mobile: sits between stacked cards. */
function StackConnector({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2 sm:hidden" aria-hidden>
      <ConnectorLabel label={label} />
    </div>
  )
}

/**
 * Desktop: dedicated column between cards.
 * Height matches the media band (aspect 4/3 of each card column).
 */
function BetweenConnector({
  label,
  columnCount,
}: {
  label: string
  columnCount: number
}) {
  const connectorTotalRem = (columnCount - 1) * CONNECTOR_WIDTH_REM

  return (
    <div
      className="relative hidden shrink-0 sm:flex sm:items-center sm:justify-center"
      style={{
        width: `${CONNECTOR_WIDTH_REM}rem`,
        height: `calc((100cqw - ${connectorTotalRem}rem) / ${columnCount} * 3 / 4)`,
      }}
      aria-hidden
    >
      <ConnectorLabel label={label} />
    </div>
  )
}

function itemDescription(item: OptionItem): string {
  if (!item.meta) return item.description
  return `${item.description} · ${item.meta}`
}

function OptionCard({ item, index }: { item: OptionItem; index: number }) {
  return (
    <ShaderDemoCard
      href={item.href}
      buttonLabel={item.ctaLabel ?? item.title}
      title={item.title}
      description={itemDescription(item)}
      mediaSrc={item.mediaSrc}
      mediaAlt={item.mediaAlt}
      animationDelay={index * 0.35}
      className="w-full"
    />
  )
}

function ChoiceLayout({
  relation,
  items,
}: {
  relation: Exclude<OptionRelation, "steps">
  items: OptionItem[]
}) {
  const label = relationLabel(relation)
  const columnCount = items.length

  return (
    <div
      className="@container flex flex-col sm:flex-row sm:items-start"
      role="list"
      aria-label={relation === "or" ? "Pick one option" : "Complete all options"}
    >
      {items.map((item, index) => (
        <Fragment key={item.href}>
          {index > 0 ? (
            <>
              <StackConnector label={label} />
              <BetweenConnector label={label} columnCount={columnCount} />
            </>
          ) : null}
          <div className="min-w-0 flex-1" role="listitem">
            <OptionCard item={item} index={index} />
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function StepsLayout({ items }: { items: OptionItem[] }) {
  return (
    <ol className="flex flex-col gap-8">
      {items.map((item, index) => (
        <li key={item.href} className="flex gap-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {itemDescription(item)}
            </p>
            <Link
              href={item.href}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {item.ctaLabel ?? item.title}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Reusable option group: same item chrome, relation-aware layout.
 * - `or` / `and`: equal cards with muted connectors
 * - `steps`: numbered sequential list
 */
export function OptionGroup({
  heading,
  relation,
  items,
  className,
}: OptionGroupProps) {
  if (items.length === 0) return null

  let body: ReactNode
  switch (relation) {
    case "or":
    case "and":
      body = <ChoiceLayout relation={relation} items={items} />
      break
    case "steps":
      body = <StepsLayout items={items} />
      break
    default: {
      const _exhaustive: never = relation
      body = _exhaustive
    }
  }

  return (
    <section className={cn("flex flex-col gap-4 border-t border-border/70 pt-8", className)}>
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {heading}
      </h2>
      {body}
    </section>
  )
}
