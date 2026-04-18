import type { AnswerCapsule } from "@/lib/types/feature-landing"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  capsules: AnswerCapsule[]
  className?: string
  /** Visible section title (defaults to “At a glance”) */
  sectionTitle?: string
}

export function FeatureLandingAnswerCapsules({ capsules, className, sectionTitle = "At a glance" }: Props) {
  if (capsules.length === 0) return null
  return (
    <div className={cn("w-full", className)}>
      <h2 className="mb-6 text-balance text-center text-2xl font-semibold tracking-tight text-foreground sm:mb-8 sm:text-3xl">
        {sectionTitle}
      </h2>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6"
        role="list"
      >
        {capsules.map((c) => (
          <Card
            key={c.question}
            role="listitem"
            size="sm"
            className="h-full border-border/70 bg-card/90 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] ring-border/60 backdrop-blur-sm transition-shadow hover:shadow-[0_28px_56px_-10px_rgba(0,0,0,0.45)] dark:bg-card/80 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]"
          >
            <CardHeader className="border-b border-border/50 pb-3">
                <h3 className="text-left text-base font-semibold leading-snug text-foreground sm:text-[1.05rem]">
                  {c.question}
                </h3>
            </CardHeader>
            <CardContent className="pt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              {c.answer}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
