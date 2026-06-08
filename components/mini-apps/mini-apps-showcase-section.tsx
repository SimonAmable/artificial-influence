import Link from "next/link"
import type { MiniApp } from "@/lib/mini-apps/types"

interface MiniAppsShowcaseSectionProps {
  miniApps: MiniApp[]
}

export function MiniAppsShowcaseSection({ miniApps }: MiniAppsShowcaseSectionProps) {
  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Creator apps
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Open a focused app built for a specific workflow, with just the inputs and outputs that matter.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link href="/slideshows" className="group block">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
              <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.22),_transparent_35%),linear-gradient(135deg,_hsl(var(--card)),_hsl(var(--muted)/0.8)_70%)]">
                <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.4)_1px,transparent_1px)] [background-position:center] [background-size:36px_36px]" />
                <div className="absolute inset-x-8 top-10 rounded-[2rem] border border-border/60 bg-background/80 p-5 shadow-xl backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-primary">AI-first slideshow</p>
                  <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Slideshows</h2>
                  <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
                    Pick an account and brand, generate hooks, auto-build slides from collections, and finish with an editable Autopost draft.
                  </p>
                </div>

                <div className="absolute bottom-8 left-8 right-8 grid grid-cols-3 gap-3">
                  {["Hook ideas", "AI slide picks", "Draft to Autopost"].map((label, index) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur transition-transform duration-300 group-hover:-translate-y-0.5"
                      style={{ transitionDelay: `${index * 40}ms` }}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {index + 1}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Link>

          {miniApps.map((miniApp) => (
            <Link
              key={miniApp.id}
              href={`/apps/${miniApp.slug}`}
              className="group block"
            >
              <div className="relative overflow-hidden rounded-3xl bg-black">
                <div className="relative aspect-square w-full">
                  {miniApp.thumbnail_url ? (
                    <img
                      src={miniApp.thumbnail_url}
                      alt={miniApp.name}
                      className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-900" />
                  )}
                </div>

                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-black/75 from-35% via-black/45 to-transparent"
                  aria-hidden
                />

                <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12">
                  <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                      {miniApp.name}
                    </h2>
                    {miniApp.description ? (
                      <p className="mt-3 text-sm text-white/70 sm:text-base">
                        {miniApp.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {miniApps.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No published mini apps yet. Slideshows is available above as a dedicated creation area.
          </p>
        ) : null}
      </div>
    </section>
  )
}
