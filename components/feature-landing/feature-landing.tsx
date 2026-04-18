import type { FeatureLandingConfig, FeatureLandingSlots } from "@/lib/types/feature-landing"

import { FeatureLandingBento } from "@/components/feature-landing/feature-landing-bento"
import { FeatureLandingComparisonTable } from "@/components/feature-landing/feature-landing-comparison-table"
import { FeatureLandingCta } from "@/components/feature-landing/feature-landing-cta"
import { FeatureLandingFaq } from "@/components/feature-landing/feature-landing-faq"
import { FeatureLandingFeatureList } from "@/components/feature-landing/feature-landing-feature-list"
import { FeatureLandingHero } from "@/components/feature-landing/feature-landing-hero"
import { FeatureLandingJsonLd } from "@/components/feature-landing/feature-landing-jsonld"
import { FeatureLandingLastUpdated } from "@/components/feature-landing/feature-landing-last-updated"

type Props = {
  config: FeatureLandingConfig
  slots?: FeatureLandingSlots
}

export function FeatureLanding({ config, slots }: Props) {
  return (
    <>
      <article className="min-h-dvh bg-background">
        <FeatureLandingHero hero={config.hero} answerCapsules={config.answerCapsules} />
        {slots?.afterHero}
        {slots?.beforeShowcase}
        {config.bento ? <FeatureLandingBento bento={config.bento} /> : null}
        {slots?.afterShowcase}
        {config.comparison ? <FeatureLandingComparisonTable comparison={config.comparison} /> : null}
        {config.features ? <FeatureLandingFeatureList features={config.features} /> : null}
        {slots?.beforeFAQ}
        <FeatureLandingFaq faq={config.faq} />
        {slots?.afterFAQ}
        <FeatureLandingLastUpdated lastUpdated={config.lastUpdated} />
        <FeatureLandingCta cta={config.cta} />
      </article>
      <FeatureLandingJsonLd config={config} />
    </>
  )
}
