import Link from "next/link"
import { Button } from "@/components/ui/button"

export function FinalCTASection() {
  return (
    <section className="w-full bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
          Launch your next creative campaign faster
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Build once, iterate visually, and ship ready-to-publish assets from a single workspace.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login?mode=signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
