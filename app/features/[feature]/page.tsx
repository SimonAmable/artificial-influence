import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { dashboardFeatures } from "@/lib/constants/dashboard-features"

interface FeaturePageProps {
  params: Promise<{
    feature: string
  }>
}

export default async function FeaturePage({ params }: FeaturePageProps) {
  const resolvedParams = await params
  const feature = dashboardFeatures.find((item) => item.slug === resolvedParams.feature)

  if (!feature) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Feature Spotlight
              </p>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{feature.title}</h1>
              <p className="mt-3 text-sm text-muted-foreground md:text-base">
                {feature.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href={feature.toolHref}>Open Tool</Link>
              </Button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-muted/20">
            {feature.media.type === "video" ? (
              <video
                src={feature.media.src}
                poster={feature.media.poster}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={feature.media.src}
                alt={feature.title}
                width={1200}
                height={720}
                className="h-full w-full object-cover"
                priority
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {feature.highlights.map((highlight) => (
              <div
                key={highlight}
                className="rounded-2xl border border-white/10 bg-muted/30 px-4 py-4 text-sm"
              >
                {highlight}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function generateStaticParams() {
  return dashboardFeatures.map((feature) => ({
    feature: feature.slug,
  }))
}
