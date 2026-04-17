import Link from "next/link"
import { Button } from "@/components/ui/button"

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL ?? "support@synthetichumanlabs.com"

export function FinalCTASection() {
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contact: teams and small business support")}`

  return (
    <section className="w-full bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
          Launch your next creative campaign faster
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Build once, iterate visually, and ship ready-to-publish assets from a single workspace.
          Custom support for teams and small businesses. Talk to us when you need onboarding help,
          billing questions, or a tailored setup.
        </p>
        <div className="mt-8 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
          <Link href="/login?mode=signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">
              View Pricing
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
