import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full bg-background py-12">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
            Artificial Influence
          </p>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            A cinematic AI workflow for creators and teams producing modern brand content.
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
      </div>

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
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
          Copyright {new Date().getFullYear()} Artificial Influence. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
