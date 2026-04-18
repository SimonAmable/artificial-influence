"use client"

import type { ElementType } from "react"
import {
  Calendar,
  ChatCircleDots,
  Clock,
  Globe,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react"

import type { FeatureLandingBentoIconId, FeatureLandingConfig } from "@/lib/types/feature-landing"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ICON_MAP: Record<FeatureLandingBentoIconId, ElementType> = {
  clock: Clock,
  globe: Globe,
  "chat-circle-dots": ChatCircleDots,
  "users-three": UsersThree,
  sparkle: Sparkle,
  calendar: Calendar,
}

type BentoProps = {
  bento: NonNullable<FeatureLandingConfig["bento"]>
}

export function FeatureLandingBento({ bento }: BentoProps) {
  return (
    <section className="border-b border-border/60 bg-background py-14 sm:py-18" aria-labelledby="bento-heading">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <h2
          id="bento-heading"
          className="max-w-3xl text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          {bento.heading}
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-6">
          {bento.items.map((item) => {
            const Icon = ICON_MAP[item.icon]
            return (
              <li key={item.name} className="group min-w-0">
                <Card className="h-full rounded-2xl border-border/70 bg-card/90 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-lg">
                  <CardHeader className="h-full gap-4 p-5 sm:p-6">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 ring-1 ring-primary/15">
                      <Icon className="h-5 w-5 text-primary" aria-hidden />
                    </span>
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold leading-tight">
                      <span>{item.name}</span>
                    </CardTitle>
                    <CardDescription className="text-[0.95rem] leading-relaxed text-muted-foreground/95">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
