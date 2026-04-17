import Link from "next/link"

export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-background py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/logo.svg')] bg-cover bg-center bg-no-repeat opacity-[0.05] dark:opacity-[0.06]"
      />
      <div className="relative z-10">
        <div className="grid w-full gap-10 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
              UniCan
            </p>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Image, video, audio, social automation, and agents in one place for creators and teams shipping content in 2026.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">Explore</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/image" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Image
                </Link>
              </li>
              <li>
                <Link href="/video" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Video
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">Legal</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/delete-account"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Delete account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 border-t pt-6 pb-4">
            <span className="text-xs text-muted-foreground">
              Chat with AI to learn more
            </span>
            <svg
              className="h-4 w-4 text-primary animate-pulse"
              fill="none"
              strokeWidth="2.5"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
          <div className="text-sm text-muted-foreground">
            Copyright {new Date().getFullYear()} UniCan. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
