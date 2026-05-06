import { Star } from "lucide-react"

const testimonialData = [
  {
    title: "30 days of content queued in seconds with automations",
    quote:
      "Automations seriously changed how we post. We can queue up 30 days of content in seconds, keep everything moving, and skip the weekly rush that used to take hours.",
    name: "Daniel",
    initials: "D",
  },
  {
    title: "It helped us grow an AI influencer faster than our manual workflow",
    quote:
      "We used UniCan to grow an AI influencer account way more smoothly. Posting got faster, testing got easier, and views started going up once we found what worked.",
    name: "Luna",
    initials: "L",
  },
  {
    title: "Our weekly thumbnail queue now takes minutes, not days",
    quote:
      "The agent saves us about 7 hours a week. We can make 20 custom thumbnails in minutes, move faster on every upload, and skip a lot of the usual back and forth.",
    name: "Sohan",
    initials: "SO",
  },
] as const

export function TestimonialsSection() {
  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Testimonials
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-0">
          {testimonialData.map((testimonial, index) => (
            <article
              key={testimonial.name}
              className={`flex min-h-[320px] flex-col px-0 md:px-12 ${
                index > 0 ? "md:border-l md:border-border/60" : ""
              }`}
            >
              <h3 className="mt-8 max-w-sm text-2xl font-semibold leading-tight text-foreground">
                {testimonial.title}
              </h3>
              <p className="mt-5 max-w-md text-base leading-8 text-muted-foreground">
                {testimonial.quote}
              </p>
              <div className="mt-auto flex items-center gap-3 pt-14">
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
