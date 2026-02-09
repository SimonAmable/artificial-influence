import Link from "next/link"
import { modelCards } from "@/lib/constants/landing-content"
import { Button } from "@/components/ui/button"

export function ModelsSection() {
  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Model Stack
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
              One platform, many generation systems
            </h2>
            <p className="mt-4 text-muted-foreground">
              Move between image, motion, voice, and editing capabilities without changing tools.
            </p>
          </div>
          <Link href="/pricing">
            <Button variant="outline">View Pricing</Button>
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {modelCards.map((card) => (
            <Link
              key={card.name}
              href={card.href}
              className="group relative overflow-hidden rounded-3xl border border-white/15 bg-card/40 p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0">
                {card.mediaType === "video" ? (
                  <video
                    src={card.mediaSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.mediaSrc} alt={card.name} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>

              <div className="relative z-10 flex min-h-[260px] flex-col justify-end">
                <h3 className="text-2xl font-semibold text-zinc-50">{card.name}</h3>
                <p className="mt-2 max-w-md text-sm text-zinc-200/90">{card.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
