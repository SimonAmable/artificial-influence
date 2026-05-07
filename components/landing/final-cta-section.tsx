import Link from "next/link"
import { Button } from "@/components/ui/button"

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL ?? "support@synthetichumanlabs.com"
const X_PROFILE_HREF = "https://x.com/Simoncodingshit"

function XLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      <path d="M18.244 2H21.5l-7.11 8.128L22.75 22h-6.547l-5.126-6.697L5.216 22H1.958l7.605-8.692L1.25 2h6.713l4.633 6.11L18.244 2Zm-1.142 18h1.804L6.978 3.895H5.043L17.102 20Z" />
    </svg>
  )
}

export function FinalCTASection() {
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contact: teams and small business support")}`

  return (
    <section className="w-full bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
          Built to make content creation feel easier
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          I&apos;m building UniCan to make organic marketing and faceless content easier for everyone.
          I want it to save you time, help you grow, and create more opportunities to make money.
          If there&apos;s something that would help you reach your goals faster, please reach out.
          I&apos;m happy to help.
        </p>
        <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
          <Link href="/login?mode=signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/#pricing">
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </Link>
          <Button variant="outline" size="lg" asChild>
            <a href={X_PROFILE_HREF} target="_blank" rel="noreferrer">
              <XLogo />
              Follow on X
            </a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href={contactHref}>Contact us</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
