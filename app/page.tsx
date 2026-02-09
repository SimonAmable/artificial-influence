import { CanvasHeroSection } from "@/components/landing/canvas-hero-section"
import { WorkflowShowcaseSection } from "@/components/landing/workflow-showcase-section"
import { ModelsSection } from "@/components/landing/models-section"
import { ProcessSection } from "@/components/landing/process-section"
import { ProofSection } from "@/components/landing/proof-section"
import { FAQSection } from "@/components/landing/faq-section"
import { FinalCTASection } from "@/components/landing/final-cta-section"
import { Footer } from "@/components/landing/footer"

export default function Page() {
  return (
    <>
      <CanvasHeroSection />
      <WorkflowShowcaseSection />
      <ModelsSection />
      <ProcessSection />
      <ProofSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
    </>
  )
}
