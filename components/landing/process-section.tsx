import { processSteps } from "@/lib/constants/landing-content"

export function ProcessSection() {
  return (
    <section id="process" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Production Velocity
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Creative momentum that feels instant
          </h2>
          <p className="mt-4 text-muted-foreground">
            Turn rough ideas into campaign assets through a faster visual feedback loop.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {processSteps.map((step) => (
            <article key={step.step} className="relative">
              <div className="absolute left-0 -top-3 z-10 rounded-full border border-white/30 bg-black/35 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-white">
                STEP {step.step}
              </div>
              <div className="h-56 overflow-hidden rounded-lg">
                {step.mediaType === "video" ? (
                  <video
                    src={step.mediaSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={step.mediaSrc} alt={step.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
