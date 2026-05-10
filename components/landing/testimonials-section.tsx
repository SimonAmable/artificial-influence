import { Star } from "lucide-react"

const testimonialData = [
  {
    quote:
      "They set up automations for me. I queue posts in seconds now instead of burning whole afternoons every week.",
    name: "Daniel",
    initials: "D",
  },
  {
    quote:
      "We used UniCan to grow an AI influencer account way more smoothly. Posting got faster, testing got easier, and views started going up once we found what worked.",
    name: "Luna",
    initials: "L",
  },
  {
    quote:
      "Sohan made my team custom tools for thumbnail creation, and we save about 7 hours a week, can make 20 custom thumbnails in minutes, move faster on every upload, and skip a lot of the usual back and forth.",
    name: "Sohan",
    initials: "S",
  },
] as const

export function TestimonialsSection() {
  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            What our users say about us
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:items-stretch md:gap-0">
          {testimonialData.map((testimonial, index) => (
            <article
              key={testimonial.name}
              className={`flex h-full min-h-0 flex-col gap-5 px-0 md:px-12 ${
                index > 0 ? "md:border-l md:border-border/60" : ""
              }`}
            >
              <p className="max-w-md flex-1 text-base leading-8 text-muted-foreground">
                {`"${testimonial.quote}"`}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary ring-1 ring-primary/25">
                  {testimonial.initials}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-foreground">{testimonial.name}</p>
                  <div className="flex gap-1 text-primary">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star key={starIndex} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
