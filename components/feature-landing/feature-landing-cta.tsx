import Link from "next/link"

import type { FeatureLandingConfig } from "@/lib/types/feature-landing"
import { Button } from "@/components/ui/button"

type CtaProps = {
  cta: FeatureLandingConfig["cta"]
}

export function FeatureLandingCta({ cta }: CtaProps) {
  return (
    <section className="bg-background py-16 sm:py-20" aria-labelledby="final-cta-heading">
      <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 id="final-cta-heading" className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
          {cta.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">{cta.body}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {cta.buttons.map((b) => (
            <Button key={b.label} asChild size="lg" variant={b.variant ?? "default"}>
              <Link href={b.href}>{b.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
