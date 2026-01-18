import { HeroSection } from "@/components/landing/hero-section"
import { FeatureSection } from "@/components/landing/feature-section"
import { FAQSection } from "@/components/landing/faq-section"
import { Footer } from "@/components/landing/footer"

export default function Page() {
  return (
    <>
      <HeroSection />
      <FeatureSection />
      <FAQSection />
      <Footer />
    </>
  )
}