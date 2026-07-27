"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle } from "@phosphor-icons/react"

import { useGuideProgress } from "@/components/guides/use-guide-progress"
import type { GuideHubCard } from "@/lib/guides/types"
import { cn } from "@/lib/utils"

type GuidesProgressRowProps = {
  /** Available guides that count toward progress (hub order). */
  cards: GuideHubCard[]
  className?: string
}

function getNextGuide(
  cards: GuideHubCard[],
  completed: ReadonlySet<string>,
): GuideHubCard | null {
  return cards.find((card) => card.available && !completed.has(card.slug)) ?? null
}

export function GuidesProgressRow({ cards, className }: GuidesProgressRowProps) {
  const { completed, ready } = useGuideProgress()
  const available = cards.filter((card) => card.available)
  const total = available.length
  const done = ready ? available.filter((card) => completed.has(card.slug)).length : 0
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const allDone = ready && total > 0 && done === total
  const nextGuide = ready ? getNextGuide(available, completed) : null

  if (total === 0) return null

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:gap-6",
        className,
      )}
      aria-label={
        ready
          ? `${done} of ${total} guides complete`
          : `${total} guides`
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {allDone ? (
              <>
                <CheckCircle className="size-3.5 text-foreground" weight="fill" aria-hidden />
                All guides complete
              </>
            ) : (
              "Your progress"
            )}
          </span>
          <span
            className={cn(
              "tabular-nums tracking-tight transition-opacity",
              ready ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="font-medium text-foreground">{done}</span>
            <span className="text-muted-foreground"> / {total}</span>
          </span>
        </div>

        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/80">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
            style={{ width: ready ? `${pct}%` : "0%" }}
          />
        </div>
      </div>

      {nextGuide ? (
        <Link
          href={`/guides/${nextGuide.slug}`}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-stretch rounded-lg border border-border/70 bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 sm:self-auto"
        >
          {done === 0 ? "Start" : "Next"}
          <span className="max-w-48 truncate sm:max-w-56">{nextGuide.title}</span>
          <ArrowRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
