import { HeroSection } from "@/components/landing/hero-section"
import { FeatureSection } from "@/components/landing/feature-section"
import { ProofSection } from "@/components/landing/proof-section"
import { FAQSection } from "@/components/landing/faq-section"
import { Footer } from "@/components/landing/footer"

export default function Page() {
  return (
    <>
      <HeroSection />
      <FeatureSection />
      <ProofSection />
      <FAQSection />
      <Footer />
    </>
  )
}