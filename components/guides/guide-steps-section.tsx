"use client"

import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react"

import { GuideStepDemo } from "@/components/guides/guide-step-demos"
import { Button } from "@/components/ui/button"
import type { GuideStep } from "@/lib/guides/types"
import { currentProduct } from "@/lib/product/current"
import { isVisibleByProductMetadata } from "@/lib/product/visibility"
import { cn } from "@/lib/utils"

export function GuideStepsSection({
  heading,
  steps,
}: {
  heading: string
  steps: GuideStep[]
}) {
  const visibleSteps = steps.filter((step) =>
    isVisibleByProductMetadata(step, currentProduct.id)
  )

  return (
    <section className="flex flex-col gap-6 border-t border-border/70 pt-8">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {heading}
      </h2>

      <ol className="flex flex-col gap-10">
        {visibleSteps.map((step, index) => {
          const mediaFirst = index % 2 === 1
          return (
            <li
              key={step.title}
              className="grid grid-cols-1 items-center gap-5 md:grid-cols-2 md:gap-8"
            >
              <div
                className={cn(
                  "order-1 min-w-0",
                  mediaFirst ? "md:order-2" : "md:order-1"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
                    {step.ctaHref && step.ctaLabel ? (
                      <Button asChild variant="outline" size="sm" className="mt-3">
                        <Link href={step.ctaHref}>
                          {step.ctaLabel}
                          <ArrowRight data-icon="inline-end" className="size-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "order-first min-w-0",
                  mediaFirst ? "md:order-1" : "md:order-2"
                )}
              >
                {step.demo ? (
                  <GuideStepDemo demoId={step.demo} />
                ) : (
                  <div className="min-h-[180px] rounded-2xl border border-dashed border-border/60 bg-muted/20" />
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
