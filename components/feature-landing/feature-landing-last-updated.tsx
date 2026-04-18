import type { FeatureLandingConfig } from "@/lib/types/feature-landing"

export function FeatureLandingLastUpdated({ lastUpdated }: { lastUpdated: FeatureLandingConfig["lastUpdated"] }) {
  const formatted = new Date(lastUpdated).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  return (
    <p className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted-foreground lg:px-8">
      Last updated: {formatted}
    </p>
  )
}
