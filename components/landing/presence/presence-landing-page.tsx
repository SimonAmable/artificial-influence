import { Footer } from "@/components/landing/footer"
import { PricingSection } from "@/components/landing/pricing-section"
import { PresenceFaqSection } from "@/components/landing/presence/presence-faq-section"
import { PresenceFinalCta } from "@/components/landing/presence/presence-final-cta"
import { PresenceHero } from "@/components/landing/presence/presence-hero"
import { PresenceModelsSection } from "@/components/landing/presence/presence-models-section"
import { PresenceMonetizeSection } from "@/components/landing/presence/presence-monetize-section"
import { PresenceProofSection } from "@/components/landing/presence/presence-proof-section"
import { PresenceWorkflowSection } from "@/components/landing/presence/presence-workflow-section"

export function PresenceLandingPage() {
  return (
    <>
      <div className="flex min-h-dvh bg-background">
        <main className="min-w-0 flex-1">
          <PresenceHero />
        </main>
      </div>
      <div id="platform-surfaces">
        <PresenceProofSection />
      </div>
      <PresenceWorkflowSection />
      <PresenceMonetizeSection />
      <PresenceModelsSection />
      <PricingSection embedded />
      <PresenceFaqSection />
      <PresenceFinalCta />
      <Footer />
    </>
  )
}
