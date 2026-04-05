import Link from "next/link"
import type { MiniApp } from "@/lib/mini-apps/types"

interface MiniAppsShowcaseSectionProps {
  miniApps: MiniApp[]
}

export function MiniAppsShowcaseSection({ miniApps }: MiniAppsShowcaseSectionProps) {
  if (miniApps.length === 0) {
    return (
      <section className="w-full bg-background py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Mini Apps
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
              Published creator apps
            </h1>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              No mini apps are published yet.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mini Apps
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Published creator apps
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Open a focused app built from a workflow, with just the inputs and outputs that matter.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {miniApps.map((miniApp) => (
            <Link
              key={miniApp.id}
              href={`/apps/${miniApp.slug}`}
              className="group block"
            >
              <div className="relative overflow-hidden rounded-3xl bg-black">
                <div className="relative h-[420px] w-full sm:h-[520px]">
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

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                      Mini App
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
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
      </div>
    </section>
  )
}
