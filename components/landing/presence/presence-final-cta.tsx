import Link from "next/link"
import { Button } from "@/components/ui/button"
import { presenceLandingCopy } from "@/lib/constants/presence-landing-content"

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL ?? "support@synthetichumanlabs.com"

export function PresenceFinalCta() {
  const { finalCta } = presenceLandingCopy
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(finalCta.contactSubject)}`

  return (
    <section className="w-full bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
          {finalCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{finalCta.description}</p>
        <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
          <Link href={finalCta.primaryCtaHref}>
            <Button size="lg">{finalCta.primaryCtaLabel}</Button>
          </Link>
          <Link href={finalCta.secondaryCtaHref}>
            <Button variant="outline" size="lg">
              {finalCta.secondaryCtaLabel}
            </Button>
          </Link>
          <Button variant="outline" size="lg" asChild>
            <a href={contactHref}>Contact us</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
